// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/USDSceneRuntime.mjs
// Shared browser-side USD scene preview runtime for Nodevision USD viewers/editors.

import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";

export const DEFAULT_USDA_SCENE = `#usda 1.0
(
    defaultPrim = "Scene"
)

def Xform "Scene"
{
    def Cube "Cube"
    {
        double size = 2
        double3 xformOp:translate = (0, 1, 0)
        float3 xformOp:rotateXYZ = (0, 25, 0)
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:rotateXYZ"]
    }

    def Sphere "Marker"
    {
        double radius = 0.35
        double3 xformOp:translate = (1.65, 2.1, 0)
        uniform token[] xformOpOrder = ["xformOp:translate"]
    }
}
`;

const USD_TEXT_ENCODER = new TextDecoder("utf-8", { fatal: false });
let usdLoaderPromise = null;

export function usdModelUrl(pathValue = "", serverBase = "/Notebook") {
  const base = String(serverBase || "/Notebook").replace(/\/+$/, "");
  const clean = String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "");
  const encoded = clean.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${base}/${encoded}`;
}

function isLikelyTextBuffer(buffer) {
  const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  const sample = bytes.slice(0, Math.min(bytes.length, 2048));
  if (!sample.length) return true;
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return suspicious / sample.length < 0.08;
}

function parseNumberList(raw = "") {
  return String(raw)
    .replace(/[()[\],]/g, " ")
    .split(/\s+/)
    .map((value) => Number(value))
    .filter(Number.isFinite);
}

function parseVec3(raw = "", fallback = [0, 0, 0]) {
  const nums = parseNumberList(raw);
  return [
    Number.isFinite(nums[0]) ? nums[0] : fallback[0],
    Number.isFinite(nums[1]) ? nums[1] : fallback[1],
    Number.isFinite(nums[2]) ? nums[2] : fallback[2],
  ];
}

function parseSingleNumber(raw = "", fallback = 1) {
  const nums = parseNumberList(raw);
  return Number.isFinite(nums[0]) ? nums[0] : fallback;
}

function matchVec(body = "", key = "", fallback = [0, 0, 0]) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*=\\s*\\(([^)]*)\\)", "m");
  const match = body.match(re);
  return match ? parseVec3(match[1], fallback) : fallback;
}

function matchNumber(body = "", key = "", fallback = 1) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*=\\s*([-+0-9.eE]+)", "m");
  const match = body.match(re);
  return match ? parseSingleNumber(match[1], fallback) : fallback;
}

function matchColor(body = "") {
  const match =
    body.match(/color3f\[\]\s+primvars:displayColor\s*=\s*\[\s*\(([^)]*)\)/m) ||
    body.match(/color3f\s+inputs:diffuseColor\s*=\s*\(([^)]*)\)/m);
  return match ? parseVec3(match[1], [0.62, 0.72, 0.84]) : [0.62, 0.72, 0.84];
}

function readBracketList(body = "", keyPattern = "") {
  const match = body.match(new RegExp(keyPattern + "\\s*=\\s*\\[([\\s\\S]*?)\\]", "m"));
  return match ? parseNumberList(match[1]) : [];
}

function primitiveBlocks(text = "") {
  const source = String(text || "");
  const re = /\bdef\s+(Mesh|Cube|Sphere|Cylinder|Cone)\s+"([^"]+)"[^{]*\{/g;
  const blocks = [];
  let match;
  while ((match = re.exec(source))) {
    let depth = 1;
    let cursor = re.lastIndex;
    while (cursor < source.length && depth > 0) {
      const ch = source[cursor];
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      cursor += 1;
    }
    blocks.push({
      type: match[1],
      name: match[2],
      body: source.slice(re.lastIndex, Math.max(re.lastIndex, cursor - 1)),
    });
    re.lastIndex = cursor;
  }
  return blocks;
}

function applyUsdTransform(object, body = "") {
  const translate = matchVec(body, "xformOp:translate", [0, 0, 0]);
  const scale = matchVec(body, "xformOp:scale", [1, 1, 1]);
  const rotate = matchVec(body, "xformOp:rotateXYZ", [0, 0, 0]);
  object.position.set(translate[0], translate[1], translate[2]);
  object.scale.set(scale[0] || 1, scale[1] || 1, scale[2] || 1);
  object.rotation.set(
    THREE.MathUtils.degToRad(rotate[0] || 0),
    THREE.MathUtils.degToRad(rotate[1] || 0),
    THREE.MathUtils.degToRad(rotate[2] || 0),
  );
}

function createMaterial(body = "") {
  const color = matchColor(body);
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color[0], color[1], color[2]),
    roughness: 0.72,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });
}

function buildMeshGeometry(body = "") {
  const pointValues = readBracketList(body, "point3f\\[\\]\\s+points");
  const counts = readBracketList(body, "int\\[\\]\\s+faceVertexCounts");
  const indices = readBracketList(body, "int\\[\\]\\s+faceVertexIndices").map((n) => Math.trunc(n));
  const points = [];
  for (let i = 0; i < pointValues.length; i += 3) {
    points.push([pointValues[i] || 0, pointValues[i + 1] || 0, pointValues[i + 2] || 0]);
  }
  if (points.length < 3 || !counts.length || !indices.length) return null;

  const positions = [];
  let cursor = 0;
  for (const rawCount of counts) {
    const count = Math.max(0, Math.trunc(rawCount));
    const face = indices.slice(cursor, cursor + count).filter((index) => points[index]);
    cursor += count;
    if (face.length < 3) continue;
    for (let i = 1; i < face.length - 1; i += 1) {
      [face[0], face[i], face[i + 1]].forEach((index) => positions.push(...points[index]));
    }
  }
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function parseUsdTextToObject(text = "") {
  const root = new THREE.Group();
  root.name = "USDStageFallback";

  primitiveBlocks(text).forEach((block) => {
    let geometry = null;
    if (block.type === "Mesh") geometry = buildMeshGeometry(block.body);
    if (block.type === "Cube") geometry = new THREE.BoxGeometry(matchNumber(block.body, "size", 2), matchNumber(block.body, "size", 2), matchNumber(block.body, "size", 2));
    if (block.type === "Sphere") geometry = new THREE.SphereGeometry(matchNumber(block.body, "radius", 1), 36, 18);
    if (block.type === "Cylinder") geometry = new THREE.CylinderGeometry(matchNumber(block.body, "radius", 1), matchNumber(block.body, "radius", 1), matchNumber(block.body, "height", 2), 36);
    if (block.type === "Cone") geometry = new THREE.ConeGeometry(matchNumber(block.body, "radius", 1), matchNumber(block.body, "height", 2), 36);
    if (!geometry) return;

    const mesh = new THREE.Mesh(geometry, createMaterial(block.body));
    mesh.name = block.name || block.type;
    applyUsdTransform(mesh, block.body);
    root.add(mesh);
  });

  return root;
}

function disposeMaterial(material) {
  if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.());
  else material?.dispose?.();
}

function disposeObject(root) {
  root?.traverse?.((node) => {
    node.geometry?.dispose?.();
    disposeMaterial(node.material);
  });
}

async function loadUSDLoader() {
  if (!usdLoaderPromise) {
    usdLoaderPromise = import("/lib/three/USDLoader.js")
      .then((mod) => mod.USDLoader)
      .catch((err) => {
        console.warn("[USDSceneRuntime] Local USDLoader unavailable; using text fallback.", err);
        return null;
      });
  }
  return await usdLoaderPromise;
}

export class USDSceneViewer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.root = null;
    this.resizeObserver = null;
    this.resizeHandler = null;
    this.statusEl = null;
    this.disposed = false;
    this.init();
  }

  init() {
    const c = this.container;
    c.innerHTML = "";
    c.style.position = "relative";
    c.style.minWidth = "0";
    c.style.minHeight = this.options.minHeight || "300px";
    c.style.width = "100%";
    c.style.height = this.options.height || "100%";
    c.style.overflow = "hidden";
    c.style.background = this.options.background || "#151a20";

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.options.background || "#151a20");

    const size = this.size();
    this.camera = new THREE.PerspectiveCamera(45, size.width / size.height, 0.01, 100000);
    this.camera.position.set(4, 3, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(size.width, size.height, false);
    if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping) this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.style.cssText = "display:block;width:100%;height:100%;";
    c.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.screenSpacePanning = true;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    if (THREE.MOUSE) {
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    }
    if (THREE.TOUCH) {
      this.controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
    }

    this.scene.add(new THREE.HemisphereLight("#ffffff", "#64748b", 1.75));
    const key = new THREE.DirectionalLight("#ffffff", 2.1);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#cbd5e1", 0.55);
    fill.position.set(-4, 3, -6);
    this.scene.add(fill);
    this.scene.add(new THREE.GridHelper(12, 12, 0x7c8796, 0x384150));
    this.scene.add(new THREE.AxesHelper(1.8));

    this.statusEl = document.createElement("div");
    this.statusEl.style.cssText = "position:absolute;left:10px;bottom:10px;right:10px;max-width:520px;padding:7px 9px;border-radius:4px;background:rgba(255,255,255,0.9);color:#1f2933;font:12px/1.35 system-ui,sans-serif;z-index:3;";
    c.appendChild(this.statusEl);

    this.resizeHandler = () => this.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(c);
    } else {
      window.addEventListener("resize", this.resizeHandler);
    }
    this.renderer.setAnimationLoop(() => this.animate());
    this.setStatus("Ready");
  }

  size() {
    const rect = this.container.getBoundingClientRect?.();
    return {
      width: Math.max(1, rect?.width || this.container.clientWidth || 1),
      height: Math.max(1, rect?.height || this.container.clientHeight || 1),
    };
  }

  setStatus(message = "", isError = false) {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
    this.statusEl.style.display = message ? "block" : "none";
    this.statusEl.style.background = isError ? "rgba(127,29,29,0.92)" : "rgba(255,255,255,0.9)";
    this.statusEl.style.color = isError ? "#fff" : "#1f2933";
  }

  animate() {
    if (this.disposed) return;
    this.controls?.update?.();
    this.renderer?.render?.(this.scene, this.camera);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const size = this.size();
    this.camera.aspect = size.width / size.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(size.width, size.height, false);
  }

  clearModel() {
    if (!this.root) return;
    this.scene.remove(this.root);
    disposeObject(this.root);
    this.root = null;
  }

  frame(root) {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) {
      this.camera.position.set(4, 3, 5);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      return;
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    root.position.sub(center);
    const distance = (maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2))) * 1.75;
    this.camera.position.set(distance, distance * 0.75, distance * 1.2);
    this.camera.near = Math.max(distance / 1000, 0.01);
    this.camera.far = Math.max(distance * 100, 1000);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  setObject(root, statusMessage = "") {
    this.clearModel();
    this.root = root || new THREE.Group();
    this.scene.add(this.root);
    this.frame(this.root);
    this.setStatus(statusMessage);
  }

  loadFromText(text = "") {
    const object = parseUsdTextToObject(text);
    if (!object.children.length) {
      this.setObject(new THREE.Group(), "USD text loaded. No basic Mesh/Cube/Sphere/Cylinder/Cone primitives found for fallback preview.");
      return false;
    }
    this.setObject(object, "Fallback USD text preview");
    return true;
  }

  async loadFromUrl(url = "") {
    this.clearModel();
    this.setStatus("Loading USD scene...");
    const Loader = await loadUSDLoader();
    if (Loader) {
      try {
        const object = await new Loader().loadAsync(url);
        this.setObject(object, "");
        return true;
      } catch (err) {
        console.warn("[USDSceneRuntime] USDLoader failed; trying text fallback.", err);
      }
    }

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const buffer = await response.arrayBuffer();
      if (!isLikelyTextBuffer(buffer)) throw new Error("Binary USD requires a USD loader that is unavailable in this browser.");
      return this.loadFromText(USD_TEXT_ENCODER.decode(buffer));
    } catch (err) {
      this.setObject(new THREE.Group(), "");
      this.setStatus(err?.message || String(err), true);
      return false;
    }
  }

  dispose() {
    this.disposed = true;
    this.renderer?.setAnimationLoop?.(null);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    else window.removeEventListener("resize", this.resizeHandler);
    this.controls?.dispose?.();
    this.clearModel();
    this.renderer?.dispose?.();
    this.container.innerHTML = "";
  }
}

export function createUSDSceneViewer(container, options = {}) {
  return new USDSceneViewer(container, options);
}

// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertUSDScenePanel.mjs
// Inserts static-safe USD scene panels into HTML/WYSIWYG documents.

import { escapeHtml, getActiveEditorNotebookPath, dirname, joinNotebookPath, normalizeNotebookPath, insertHtmlAtCaret } from "./insertMediaCommon.mjs";
import { looksLikeUrlOrAbsPath, notebookSourceFromPath, readFileAsDataUrl, saveNotebookBinaryFromDataUrl } from "./insertMediaIO.mjs";

const STATIC_USD_SCENE_SCRIPT_KEY = "nv-static-usd-scene-panels";
const USD_EXTENSIONS = ["usd", "usda", "usdc"];

const STATIC_USD_SCENE_SCRIPT = `(function(){
  "use strict";
  const RUNTIME_KEY = "NVStaticUSDScenePanels";
  const THREE_VERSION = "0.160.0";
  const CDN_BASE = "https://esm.sh/three@" + THREE_VERSION;
  const state = window[RUNTIME_KEY] || (window[RUNTIME_KEY] = {});
  if (state.installed) {
    if (typeof state.initAll === "function") state.initAll();
    return;
  }
  state.installed = true;
  state.imports = state.imports || {};

  function ensureStyle() {
    if (document.getElementById("nv-static-usd-scene-style")) return;
    const style = document.createElement("style");
    style.id = "nv-static-usd-scene-style";
    style.textContent = ".nv-usd-scene-panel{position:relative;overflow:hidden;background:#151a20;border:1px solid #2f3a48;border-radius:8px;box-sizing:border-box;min-width:220px;min-height:180px}.nv-usd-scene-panel canvas{display:block;width:100%;height:100%}.nv-usd-scene-panel [data-nv-usd-resize-handle]{display:none;position:absolute;right:0;bottom:0;width:18px;height:18px;z-index:5;cursor:nwse-resize;background:linear-gradient(135deg,transparent 0 45%,rgba(255,255,255,.72) 46% 54%,transparent 55%),linear-gradient(135deg,transparent 0 66%,rgba(255,255,255,.72) 67% 75%,transparent 76%)}[contenteditable=true] .nv-usd-scene-panel [data-nv-usd-resize-handle]{display:block}.nv-usd-scene-panel [data-nv-usd-status]{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;box-sizing:border-box;background:rgba(255,255,255,.88);color:#1f2933;font:12px/1.35 system-ui,sans-serif}.nv-usd-scene-panel a[data-nv-usd-link]{position:absolute;left:8px;bottom:8px;max-width:calc(100% - 16px);padding:3px 6px;border-radius:4px;background:rgba(255,255,255,.86);color:#1d4ed8;font:11px system-ui,sans-serif;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
    document.head.appendChild(style);
  }

  function setStatus(panel, message, isError) {
    const status = panel.querySelector("[data-nv-usd-status]");
    if (!status) return;
    status.textContent = message || "";
    status.style.display = message ? "flex" : "none";
    status.style.background = isError ? "rgba(127,29,29,.92)" : "rgba(255,255,255,.88)";
    status.style.color = isError ? "#fff" : "#1f2933";
  }

  function importCached(key, url) {
    if (!state.imports[key]) state.imports[key] = import(url);
    return state.imports[key];
  }

  async function loadCore() {
    const THREE = await importCached("three", CDN_BASE);
    const controls = await importCached("controls", CDN_BASE + "/examples/jsm/controls/OrbitControls.js");
    return { THREE: THREE, OrbitControls: controls.OrbitControls };
  }

  async function loadUSDLoader() {
    try {
      const mod = await importCached("usd", CDN_BASE + "/examples/jsm/loaders/USDLoader.js");
      return mod.USDLoader || mod.USDZLoader || null;
    } catch (err) {
      console.warn("[NVStaticUSDScenePanels] USDLoader unavailable; using text fallback.", err);
      return null;
    }
  }

  function isLikelyText(buffer) {
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

  function parseNumberList(raw) {
    return String(raw || "").replace(/[()[\\],]/g, " ").split(/\\s+/).map(Number).filter(Number.isFinite);
  }
  function parseVec3(raw, fallback) {
    const nums = parseNumberList(raw);
    return [Number.isFinite(nums[0]) ? nums[0] : fallback[0], Number.isFinite(nums[1]) ? nums[1] : fallback[1], Number.isFinite(nums[2]) ? nums[2] : fallback[2]];
  }
  function matchVec(body, key, fallback) {
    const escaped = key.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, "\\\\$&");
    const match = String(body || "").match(new RegExp(escaped + "\\\\s*=\\\\s*\\\\(([^)]*)\\\\)", "m"));
    return match ? parseVec3(match[1], fallback) : fallback;
  }
  function matchNumber(body, key, fallback) {
    const escaped = key.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, "\\\\$&");
    const match = String(body || "").match(new RegExp(escaped + "\\\\s*=\\\\s*([-+0-9.eE]+)", "m"));
    return match ? (Number(match[1]) || fallback) : fallback;
  }
  function matchColor(body) {
    const match = String(body || "").match(/color3f\\[\\]\\s+primvars:displayColor\\s*=\\s*\\[\\s*\\(([^)]*)\\)/m) || String(body || "").match(/color3f\\s+inputs:diffuseColor\\s*=\\s*\\(([^)]*)\\)/m);
    return match ? parseVec3(match[1], [0.62, 0.72, 0.84]) : [0.62, 0.72, 0.84];
  }
  function readBracketList(body, keyPattern) {
    const match = String(body || "").match(new RegExp(keyPattern + "\\\\s*=\\\\s*\\\\[([\\\\s\\\\S]*?)\\\\]", "m"));
    return match ? parseNumberList(match[1]) : [];
  }
  function primitiveBlocks(text) {
    const source = String(text || "");
    const re = /\\bdef\\s+(Mesh|Cube|Sphere|Cylinder|Cone)\\s+"([^"]+)"[^\\{]*\\{/g;
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
      blocks.push({ type: match[1], name: match[2], body: source.slice(re.lastIndex, Math.max(re.lastIndex, cursor - 1)) });
      re.lastIndex = cursor;
    }
    return blocks;
  }
  function buildMeshGeometry(THREE, body) {
    const pointValues = readBracketList(body, "point3f\\\\[\\\\]\\\\s+points");
    const counts = readBracketList(body, "int\\\\[\\\\]\\\\s+faceVertexCounts");
    const indices = readBracketList(body, "int\\\\[\\\\]\\\\s+faceVertexIndices").map((n) => Math.trunc(n));
    const points = [];
    for (let i = 0; i < pointValues.length; i += 3) points.push([pointValues[i] || 0, pointValues[i + 1] || 0, pointValues[i + 2] || 0]);
    if (points.length < 3 || !counts.length || !indices.length) return null;
    const positions = [];
    let cursor = 0;
    counts.forEach((rawCount) => {
      const count = Math.max(0, Math.trunc(rawCount));
      const face = indices.slice(cursor, cursor + count).filter((index) => points[index]);
      cursor += count;
      for (let i = 1; i < face.length - 1; i += 1) [face[0], face[i], face[i + 1]].forEach((index) => positions.push(...points[index]));
    });
    if (!positions.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }
  function applyTransform(THREE, object, body) {
    const t = matchVec(body, "xformOp:translate", [0, 0, 0]);
    const s = matchVec(body, "xformOp:scale", [1, 1, 1]);
    const r = matchVec(body, "xformOp:rotateXYZ", [0, 0, 0]);
    object.position.set(t[0], t[1], t[2]);
    object.scale.set(s[0] || 1, s[1] || 1, s[2] || 1);
    object.rotation.set(THREE.MathUtils.degToRad(r[0] || 0), THREE.MathUtils.degToRad(r[1] || 0), THREE.MathUtils.degToRad(r[2] || 0));
  }
  function parseUsdText(THREE, text) {
    const root = new THREE.Group();
    primitiveBlocks(text).forEach((block) => {
      const materialColor = matchColor(block.body);
      const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(materialColor[0], materialColor[1], materialColor[2]), roughness: 0.72, metalness: 0.06, side: THREE.DoubleSide });
      let geometry = null;
      if (block.type === "Mesh") geometry = buildMeshGeometry(THREE, block.body);
      if (block.type === "Cube") geometry = new THREE.BoxGeometry(matchNumber(block.body, "size", 2), matchNumber(block.body, "size", 2), matchNumber(block.body, "size", 2));
      if (block.type === "Sphere") geometry = new THREE.SphereGeometry(matchNumber(block.body, "radius", 1), 36, 18);
      if (block.type === "Cylinder") geometry = new THREE.CylinderGeometry(matchNumber(block.body, "radius", 1), matchNumber(block.body, "radius", 1), matchNumber(block.body, "height", 2), 36);
      if (block.type === "Cone") geometry = new THREE.ConeGeometry(matchNumber(block.body, "radius", 1), matchNumber(block.body, "height", 2), 36);
      if (!geometry) return;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = block.name || block.type;
      applyTransform(THREE, mesh, block.body);
      root.add(mesh);
    });
    return root;
  }
  function frameObject(THREE, object, camera, controls) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) {
      camera.position.set(4, 3, 5);
      controls.target.set(0, 0, 0);
      controls.update();
      return;
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    object.position.sub(center);
    const distance = (maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * 1.75;
    camera.position.set(distance, distance * 0.75, distance * 1.2);
    camera.near = Math.max(distance / 1000, 0.01);
    camera.far = Math.max(distance * 100, 1000);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  }
  function prepareControls(THREE, controls) {
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.screenSpacePanning = true;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    if (THREE.MOUSE) controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    if (THREE.TOUCH) controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  }
  function markEditorDirty(panel) {
    window.HTMLWysiwygTools?.markDirty?.();
    panel.closest("[contenteditable=true]")?.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function installEditorResizeHandle(panel) {
    const editor = panel.closest("[contenteditable=true]");
    if (!editor || panel.querySelector("[data-nv-usd-resize-handle]")) return;
    const handle = document.createElement("span");
    handle.className = "nv-editor-only";
    handle.setAttribute("data-nv-usd-resize-handle", "");
    handle.setAttribute("contenteditable", "false");
    handle.title = "Resize scene panel";
    panel.appendChild(handle);
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const start = panel.getBoundingClientRect();
      const editorRect = editor.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const maxWidth = Math.max(220, editorRect.width - 24);
      const onMove = (moveEvent) => {
        const width = Math.min(maxWidth, Math.max(220, start.width + moveEvent.clientX - startX));
        const height = Math.max(180, start.height + moveEvent.clientY - startY);
        panel.style.width = Math.round(width) + "px";
        panel.style.height = Math.round(height) + "px";
        markEditorDirty(panel);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        markEditorDirty(panel);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    });
  }
  async function initPanel(panel) {
    if (!panel || panel.dataset.nvUsdSceneReady === "true") return;
    panel.dataset.nvUsdSceneReady = "true";
    ensureStyle();
    installEditorResizeHandle(panel);
    const src = panel.dataset.src || "";
    if (!src) {
      setStatus(panel, "Missing USD source.", true);
      return;
    }
    const canvas = panel.querySelector("canvas") || document.createElement("canvas");
    if (!canvas.parentNode) panel.prepend(canvas);
    try {
      setStatus(panel, "Loading USD scene...", false);
      const core = await loadCore();
      const THREE = core.THREE;
      const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(panel.dataset.background || "#151a20");
      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
      const controls = new core.OrbitControls(camera, renderer.domElement);
      prepareControls(THREE, controls);
      scene.add(new THREE.HemisphereLight("#ffffff", "#64748b", 1.75));
      const key = new THREE.DirectionalLight("#ffffff", 2.1);
      key.position.set(5, 8, 6);
      scene.add(key);
      scene.add(new THREE.GridHelper(12, 12, 0x7c8796, 0x384150));
      scene.add(new THREE.AxesHelper(1.8));
      let object = null;
      const Loader = await loadUSDLoader();
      if (Loader) {
        try {
          object = await new Loader().loadAsync(src);
        } catch (err) {
          console.warn("[NVStaticUSDScenePanels] Loader failed; trying fallback parser.", err);
        }
      }
      if (!object) {
        const response = await fetch(src, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status + " " + response.statusText);
        const buffer = await response.arrayBuffer();
        if (!isLikelyText(buffer)) throw new Error("Binary USD needs a browser USD loader; this page could not load one.");
        object = parseUsdText(THREE, new TextDecoder("utf-8").decode(buffer));
        if (!object.children.length) throw new Error("USD loaded, but no basic fallback primitives were found.");
      }
      scene.add(object);
      frameObject(THREE, object, camera, controls);
      setStatus(panel, "", false);
      function resize() {
        const rect = panel.getBoundingClientRect();
        const width = Math.max(160, Math.floor(rect.width || 520));
        const height = Math.max(140, Math.floor(rect.height || 320));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
      observer?.observe(panel);
      window.addEventListener("resize", resize);
      resize();
      let frameId = 0;
      function animate() {
        frameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();
      panel.__nvUsdSceneDispose = function() {
        cancelAnimationFrame(frameId);
        observer?.disconnect();
        window.removeEventListener("resize", resize);
        controls.dispose?.();
        renderer.dispose?.();
      };
    } catch (err) {
      panel.dataset.nvUsdSceneReady = "error";
      setStatus(panel, err && err.message ? err.message : String(err), true);
    }
  }
  state.initPanel = initPanel;
  state.initAll = function() {
    document.querySelectorAll("[data-nv-static-usd-scene]").forEach(initPanel);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", state.initAll, { once: true });
  else state.initAll();
})();`;

function extensionFromSource(source = "") {
  const clean = String(source || "").split("?")[0].split("#")[0];
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return String(match?.[1] || "").toLowerCase();
}

function notebookPathFromSource(source = "") {
  const raw = String(source || "").trim().replace(/^\/+/, "");
  if (!/^notebook(?:\/|$)/i.test(raw)) return "";
  return normalizeNotebookPath(raw);
}

function sourceLabel(source = "") {
  return String(source || "").split(/[\\/]/).pop() || "scene.usd";
}


function sanitizeCssDimension(value = "", fallback = "320px") {
  const clean = String(value || "").trim();
  if (!clean || clean.length > 64) return fallback;
  if (!/^[a-z0-9\s().,%+-]+$/i.test(clean)) return fallback;
  return clean;
}

function buildUSDScenePanelHtml({ src, linkedPath = "", label = "", width = "min(100%,520px)", height = "320px" } = {}) {
  const source = String(src || "").trim();
  const displayLabel = String(label || sourceLabel(source) || "USD scene").trim();
  const id = "nv-usd-scene-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 10000).toString(36);
  const linkedAttr = linkedPath ? ` data-nv-linked-path="${escapeHtml(linkedPath)}"` : "";
  const safeWidth = sanitizeCssDimension(width, "min(100%,520px)");
  const safeHeight = sanitizeCssDimension(height, "320px");
  return `<div id="${escapeHtml(id)}" class="nv-usd-scene-panel" data-nv-static-usd-scene data-nv-resizable data-src="${escapeHtml(source)}" data-label="${escapeHtml(displayLabel)}"${linkedAttr} contenteditable="false" style="position:relative;width:${escapeHtml(safeWidth)};height:${escapeHtml(safeHeight)};min-width:220px;min-height:180px;margin:12px 0;border:1px solid #2f3a48;border-radius:8px;overflow:hidden;background:#151a20;box-sizing:border-box;"><canvas data-nv-usd-canvas style="display:block;width:100%;height:100%;"></canvas><div data-nv-usd-status>Loading USD scene...</div><a data-nv-usd-link href="${escapeHtml(source)}">${escapeHtml(displayLabel)}</a></div>`;
}

function insertUSDScenePanelAtCaret(options = {}) {
  insertHtmlAtCaret(buildUSDScenePanelHtml(options));
  const tools = window.HTMLWysiwygTools;
  const appended = tools?.appendScriptForSave?.(STATIC_USD_SCENE_SCRIPT, STATIC_USD_SCENE_SCRIPT_KEY);
  if (!appended) insertHtmlAtCaret(`<script>${STATIC_USD_SCENE_SCRIPT}</script>`);
  try {
    if (!window.NVStaticUSDScenePanels?.initAll) (0, eval)(STATIC_USD_SCENE_SCRIPT);
    window.NVStaticUSDScenePanels?.initAll?.();
  } catch (err) {
    console.warn("[insertUSDScenePanel] editor preview init failed:", err);
  }
}

function isUsdSource(source = "") {
  return USD_EXTENSIONS.includes(extensionFromSource(source));
}

export function renderInsertUSDScenePanel(root) {
  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:300px;max-width:660px;"><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>USD Source</legend><div style="display:flex;gap:8px;align-items:flex-end;"><label style="flex:1;">Notebook path or URL<input data-field="source" type="text" placeholder="models/scene.usd" style="display:block;width:100%;margin-top:4px;" /></label><button type="button" data-action="choose-local" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Choose File...</button></div><div data-field="local-status" style="font-size:11px;color:#4b4b4b;margin-top:6px;">No local file selected.</div></fieldset><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Panel Size</legend><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><label>Width<input data-field="width" type="text" value="min(100%,520px)" style="display:block;width:100%;margin-top:4px;" /></label><label>Height<input data-field="height" type="text" value="320px" style="display:block;width:100%;margin-top:4px;" /></label></div></fieldset><div style="display:flex;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert 3D Scene Panel</button></div><div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div></form>`;

  const form = root.querySelector("form");
  const sourceEl = root.querySelector('[data-field="source"]');
  const widthEl = root.querySelector('[data-field="width"]');
  const heightEl = root.querySelector('[data-field="height"]');
  const statusEl = root.querySelector('[data-field="status"]');
  const localStatus = root.querySelector('[data-field="local-status"]');
  const hiddenFile = document.createElement("input");
  hiddenFile.type = "file";
  hiddenFile.accept = ".usd,.usda,.usdc";
  hiddenFile.style.display = "none";
  form.appendChild(hiddenFile);

  let localFile = { dataUrl: "", name: "" };
  const setStatus = (message) => { statusEl.textContent = String(message || ""); };
  const updateLocalStatus = () => {
    localStatus.textContent = localFile.dataUrl ? `Selected: ${localFile.name}` : "No local file selected.";
  };

  root.querySelector('[data-action="choose-local"]').addEventListener("click", () => hiddenFile.click());
  hiddenFile.addEventListener("change", async () => {
    const file = hiddenFile.files?.[0];
    hiddenFile.value = "";
    if (!file) return;
    if (!isUsdSource(file.name)) {
      setStatus("Choose a .usd, .usda, or .usdc file.");
      return;
    }
    try {
      localFile = { dataUrl: await readFileAsDataUrl(file), name: file.name };
      sourceEl.value = file.name;
      sourceEl.dataset.localFile = "true";
      updateLocalStatus();
      setStatus("");
    } catch (err) {
      localFile = { dataUrl: "", name: "" };
      delete sourceEl.dataset.localFile;
      updateLocalStatus();
      setStatus(err?.message || String(err));
    }
  });

  sourceEl.addEventListener("input", () => {
    if (sourceEl.dataset.localFile === "true" && sourceEl.value !== localFile.name) {
      localFile = { dataUrl: "", name: "" };
      delete sourceEl.dataset.localFile;
      updateLocalStatus();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");
    try {
      const entered = String(sourceEl.value || "").trim();
      const editorPath = getActiveEditorNotebookPath();
      const baseDir = dirname(editorPath);
      const defaultDir = joinNotebookPath(baseDir, "models");
      const usingLocal = Boolean(localFile.dataUrl && sourceEl.dataset.localFile === "true");
      if (!entered && !usingLocal) throw new Error("Choose a USD file or enter a USD path.");
      if (!usingLocal && !isUsdSource(entered)) throw new Error("Scene panels accept .usd, .usda, and .usdc files.");

      let src = "";
      let linkedPath = "";
      let label = "";
      if (usingLocal) {
        const targetPath = normalizeNotebookPath(joinNotebookPath(defaultDir, entered || localFile.name || `scene-${Date.now()}.usd`));
        await saveNotebookBinaryFromDataUrl(targetPath, localFile.dataUrl, "model/vnd.usd");
        linkedPath = targetPath;
        src = notebookSourceFromPath(targetPath, editorPath);
        label = targetPath.split("/").pop() || targetPath;
      } else if (notebookPathFromSource(entered)) {
        linkedPath = notebookPathFromSource(entered);
        src = notebookSourceFromPath(linkedPath, editorPath);
        label = linkedPath.split("/").pop() || linkedPath;
      } else if (looksLikeUrlOrAbsPath(entered)) {
        src = entered;
        label = sourceLabel(entered);
      } else {
        linkedPath = normalizeNotebookPath(entered);
        src = notebookSourceFromPath(linkedPath, editorPath);
        label = linkedPath.split("/").pop() || linkedPath;
      }

      const html = buildUSDScenePanelHtml({
        src,
        linkedPath,
        label,
        width: widthEl.value,
        height: heightEl.value,
      });
      insertHtmlAtCaret(html);
      const tools = window.HTMLWysiwygTools;
      const appended = tools?.appendScriptForSave?.(STATIC_USD_SCENE_SCRIPT, STATIC_USD_SCENE_SCRIPT_KEY);
      if (!appended) insertHtmlAtCaret(`<script>${STATIC_USD_SCENE_SCRIPT}</script>`);
      try {
        if (!window.NVStaticUSDScenePanels?.initAll) (0, eval)(STATIC_USD_SCENE_SCRIPT);
        window.NVStaticUSDScenePanels?.initAll?.();
      } catch (err) {
        console.warn("[insertUSDScenePanel] preview init failed:", err);
      }
      setStatus("Inserted.");
    } catch (err) {
      console.warn("[insertUSDScenePanel]", err);
      setStatus(err?.message || String(err));
    }
  });

  updateLocalStatus();
}

export { STATIC_USD_SCENE_SCRIPT, buildUSDScenePanelHtml, insertUSDScenePanelAtCaret };

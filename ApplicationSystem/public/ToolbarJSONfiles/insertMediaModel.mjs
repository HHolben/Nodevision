// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaModel.mjs
// Renders and executes the Insert Model workflow with New/Existing, inline previews, and static linked 3D viewer panels.

import { escapeHtml, getActiveEditorNotebookPath, dirname, joinNotebookPath, normalizeNotebookPath, notebookHrefFromPath, saveNotebookText, insertHtmlAtCaret } from "./insertMediaCommon.mjs";
import { fetchUrlAsText, looksLikeUrlOrAbsPath, notebookSourceFromPath, readFileAsDataUrl, readFileAsText, saveNotebookBinaryFromDataUrl } from "./insertMediaIO.mjs";
import { insertUSDScenePanelAtCaret } from "./insertUSDScenePanel.mjs";

function ensureExt(fileName, ext) {
  const name = String(fileName || "").trim();
  if (!name) return "";
  const lower = name.toLowerCase();
  if (lower.endsWith(`.${ext}`)) return name;
  if (name.includes(".")) return name;
  return `${name}.${ext}`;
}

function defaultModelContent(ext, baseName) {
  const label = String(baseName || "model").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 32) || "model";
  if (ext === "stl") return `solid ${label}\n  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex 1 0 0\n      vertex 0 1 0\n    endloop\n  endfacet\nendsolid ${label}\n`;
  if (ext === "obj") return `# ${label}.obj\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n`;
  if (ext === "usd" || ext === "usda") return `#usda 1.0
(
    defaultPrim = "Scene"
)

def Xform "Scene"
{
    def Cube "Cube"
    {
        double size = 2
        double3 xformOp:translate = (0, 1, 0)
        uniform token[] xformOpOrder = ["xformOp:translate"]
    }
}
`;
  if (ext === "gltf") return JSON.stringify({ asset: { version: "2.0", generator: "Nodevision Insert Media" } }, null, 2) + "\n";
  return `# New ${ext} model placeholder (${label})\n`;
}

function pickDefaultExt(exts) {
  const list = Array.from(new Set(exts || [])).map((e) => String(e).toLowerCase()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return list.includes("stl") ? "stl" : (list[0] || "stl");
}

const STATIC_MODEL_VIEWER_SCRIPT_KEY = "nv-static-model-panels";
const USD_SCENE_EXTENSIONS = new Set(["usd", "usda", "usdc"]);
const MODEL_VIEWER_SUPPORTED_EXTENSIONS = new Set(["glb", "gltf", "obj", "ply", "stl"]);
const STATIC_MODEL_VIEWER_SCRIPT = `(function(){
  "use strict";
  const RUNTIME_KEY = "nv-static-model-panels";
  const THREE_VERSION = "0.160.0";
  const CDN_BASE = "https://esm.sh/three@" + THREE_VERSION;
  const state = window.NVStaticModelPanels || (window.NVStaticModelPanels = {});
  if (state.installed) {
    if (typeof state.initAll === "function") state.initAll();
    return;
  }
  state.installed = true;
  state.imports = state.imports || {};

  function setStatus(panel, message, isError) {
    const status = panel.querySelector("[data-nv-model-status]");
    if (!status) return;
    status.textContent = message || "";
    status.style.display = message ? "flex" : "none";
    status.style.color = isError ? "#7a1f1f" : "#26313d";
    status.style.background = isError ? "rgba(255,244,244,0.94)" : "rgba(255,255,255,0.86)";
  }

  function importCached(key, url) {
    if (!state.imports[key]) state.imports[key] = import(url);
    return state.imports[key];
  }

  async function loadCore() {
    const three = await importCached("three", CDN_BASE);
    const controls = await importCached("controls", CDN_BASE + "/examples/jsm/controls/OrbitControls.js");
    return { THREE: three, OrbitControls: controls.OrbitControls };
  }

  function extensionFromSource(src, fallback) {
    const clean = String(src || "").split("?")[0].split("#")[0];
    const name = clean.split("/").pop() || "";
    const match = name.match(/\\.([a-z0-9]+)$/i);
    return String((match && match[1]) || fallback || "").toLowerCase();
  }

  async function loadModelObject(THREE, src, ext) {
    if (ext === "glb" || ext === "gltf") {
      const mod = await importCached("gltf", CDN_BASE + "/examples/jsm/loaders/GLTFLoader.js");
      const gltf = await new mod.GLTFLoader().loadAsync(src);
      return gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null);
    }
    if (ext === "obj") {
      const mod = await importCached("obj", CDN_BASE + "/examples/jsm/loaders/OBJLoader.js");
      return await new mod.OBJLoader().loadAsync(src);
    }
    if (ext === "stl") {
      const mod = await importCached("stl", CDN_BASE + "/examples/jsm/loaders/STLLoader.js");
      const geometry = await new mod.STLLoader().loadAsync(src);
      geometry.computeVertexNormals?.();
      return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: "#aeb8c4", roughness: 0.72, metalness: 0.08 }));
    }
    if (ext === "ply") {
      const mod = await importCached("ply", CDN_BASE + "/examples/jsm/loaders/PLYLoader.js");
      const geometry = await new mod.PLYLoader().loadAsync(src);
      geometry.computeVertexNormals?.();
      return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: "#aeb8c4", roughness: 0.72, metalness: 0.08 }));
    }
    throw new Error("Unsupported model format: " + (ext || "unknown"));
  }

  function frameObject(THREE, object, camera, controls) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    object.position.sub(center);
    camera.near = Math.max(maxDim / 1000, 0.001);
    camera.far = Math.max(maxDim * 100, 1000);
    camera.position.set(maxDim * 1.25, maxDim * 0.8, maxDim * 1.85);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.minDistance = Math.max(maxDim * 0.02, 0.01);
    controls.maxDistance = Math.max(maxDim * 25, 10);
    controls.update();
  }

  function prepareObject(object) {
    object.traverse?.((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material].filter(Boolean);
      materials.forEach((mat) => {
        if (mat) mat.needsUpdate = true;
      });
    });
  }

  async function initPanel(panel) {
    if (!panel || panel.dataset.nvModelViewerReady === "true") return;
    panel.dataset.nvModelViewerReady = "true";
    const src = panel.dataset.src || panel.getAttribute("data-src") || "";
    const ext = extensionFromSource(src, panel.dataset.ext || "");
    if (!src) {
      setStatus(panel, "Missing model source.", true);
      return;
    }
    const canvas = panel.querySelector("canvas") || document.createElement("canvas");
    if (!canvas.parentNode) panel.prepend(canvas);
    Object.assign(canvas.style, { display: "block", width: "100%", height: "100%" });

    try {
      setStatus(panel, "Loading 3D model...", false);
      const { THREE, OrbitControls } = await loadCore();
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(panel.dataset.background || "#f6f7f9");
      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.screenSpacePanning = true;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      if (THREE.MOUSE) {
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
      }
      if (THREE.TOUCH) {
        controls.touches = {
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN
        };
      }

      scene.add(new THREE.HemisphereLight("#ffffff", "#aeb7c2", 1.85));
      const keyLight = new THREE.DirectionalLight("#ffffff", 2.25);
      keyLight.position.set(4, 6, 5);
      scene.add(keyLight);

      const object = await loadModelObject(THREE, src, ext);
      if (!object) throw new Error("Model did not contain a renderable scene.");
      const modelRoot = new THREE.Group();
      modelRoot.add(object);
      prepareObject(modelRoot);
      scene.add(modelRoot);
      frameObject(THREE, modelRoot, camera, controls);
      setStatus(panel, "", false);

      function resize() {
        const rect = panel.getBoundingClientRect();
        const width = Math.max(160, Math.floor(rect.width || 320));
        const height = Math.max(140, Math.floor(rect.height || Number(panel.dataset.height) || 240));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }

      let frameId = 0;
      const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
      observer?.observe(panel);
      window.addEventListener("resize", resize);
      resize();

      function animate() {
        frameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();

      panel.__nvModelViewerDispose = function() {
        cancelAnimationFrame(frameId);
        observer?.disconnect();
        window.removeEventListener("resize", resize);
        controls.dispose?.();
        renderer.dispose?.();
      };
    } catch (err) {
      panel.dataset.nvModelViewerReady = "error";
      setStatus(panel, err && err.message ? err.message : String(err), true);
    }
  }

  state.initPanel = initPanel;
  state.initAll = function() {
    document.querySelectorAll("[data-nv-static-model-viewer]").forEach((panel) => {
      initPanel(panel);
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", state.initAll, { once: true });
  } else {
    state.initAll();
  }
})();`;

function modelExtensionFromSource(source, fallback = "") {
  const clean = String(source || "").split("?")[0].split("#")[0];
  const name = clean.split("/").pop() || "";
  const match = name.match(/\.([a-z0-9]+)$/i);
  return String(match?.[1] || fallback || "").toLowerCase();
}

function notebookPathFromModelSource(source) {
  const raw = String(source || "").trim().replace(/^\/+/, "");
  return /^notebook(?:\/|$)/i.test(raw) ? normalizeNotebookPath(raw) : "";
}

function buildLinkedModelViewerHtml({ src, label, linkedPath = "", ext = "" } = {}) {
  const source = String(src || "").trim();
  const modelExt = modelExtensionFromSource(source, ext);
  const displayLabel = String(label || source.split("/").pop() || "3D model").trim() || "3D model";
  const id = "nv-model-panel-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 10000).toString(36);
  const linkedAttr = linkedPath ? ` data-nv-linked-path="${escapeHtml(linkedPath)}"` : "";
  const title = MODEL_VIEWER_SUPPORTED_EXTENSIONS.has(modelExt)
    ? displayLabel
    : `${displayLabel} (${modelExt || "unknown"})`;
  return `<div id="${escapeHtml(id)}" class="nv-3d-model-panel" data-nv-static-model-viewer data-src="${escapeHtml(source)}" data-ext="${escapeHtml(modelExt)}" data-label="${escapeHtml(displayLabel)}"${linkedAttr} contenteditable="false" style="position:relative;width:min(100%,360px);height:240px;margin:12px 0;border:1px solid #c7d0da;border-radius:8px;overflow:hidden;background:#f6f7f9;box-shadow:0 1px 3px rgba(15,23,42,0.12);"><canvas data-nv-model-canvas style="display:block;width:100%;height:100%;"></canvas><div data-nv-model-status style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;font:12px system-ui,sans-serif;color:#26313d;background:rgba(255,255,255,0.86);box-sizing:border-box;">Loading 3D model...</div><a href="${escapeHtml(source)}" style="position:absolute;left:8px;bottom:8px;max-width:calc(100% - 16px);padding:3px 6px;border-radius:4px;background:rgba(255,255,255,0.86);color:#1d4ed8;font:11px system-ui,sans-serif;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</a></div>`;
}

function insertLinkedModelViewerAtCaret(options = {}) {
  insertHtmlAtCaret(buildLinkedModelViewerHtml(options));
  const tools = window.HTMLWysiwygTools;
  const appended = tools?.appendScriptForSave?.(STATIC_MODEL_VIEWER_SCRIPT, STATIC_MODEL_VIEWER_SCRIPT_KEY);
  if (!appended) {
    insertHtmlAtCaret(`<script>${STATIC_MODEL_VIEWER_SCRIPT}</script>`);
  }
  try {
    if (!window.NVStaticModelPanels?.initAll) {
      (0, eval)(STATIC_MODEL_VIEWER_SCRIPT);
    }
    window.NVStaticModelPanels?.initAll?.();
  } catch (err) {
    console.warn("[insertMediaModel] editor preview init failed", err);
  }
}

export function renderInsertModel(root, exts = []) {
  const extensions = Array.from(new Set(exts)).map((e) => String(e).toLowerCase()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const defaultExt = pickDefaultExt(extensions);
  const options = extensions.length ? extensions : [defaultExt];

  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:300px;max-width:660px;"><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Model Source</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-source" value="new" checked> New Model</label><label style="display:block;"><input type="radio" name="nv-source" value="existing"> Existing Model</label></fieldset><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Storage Mode</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-storage" value="referenced" checked> Referenced (3D viewer panel)</label><label style="display:block;"><input type="radio" name="nv-storage" value="inline"> Inline (embed preview text)</label></fieldset><div data-section="new" style="display:flex;flex-direction:column;gap:8px;"><div data-section="new-ref" style="display:flex;flex-direction:column;gap:8px;"><label>New Model Format<select data-field="format" style="display:block;width:100%;margin-top:4px;">${options.map((e) => `<option value="${escapeHtml(e)}"${e === defaultExt ? " selected" : ""}>${escapeHtml(e)}</option>`).join("")}</select></label><label>New Model File Name<input data-field="fileName" type="text" placeholder="model.${escapeHtml(defaultExt)}" style="display:block;width:100%;margin-top:4px;" /></label></div><div style="font-size:11px;color:#666;line-height:1.3;">Inline inserts a text preview; Referenced inserts a small linked 3D panel.</div></div><div data-section="existing" style="display:none;flex-direction:column;gap:8px;"><div style="display:flex;gap:8px;align-items:flex-end;"><label style="flex:1;">Existing Source (Notebook path or URL)<input data-field="existingSource" type="text" placeholder="models/example.${escapeHtml(defaultExt)} or https://..." style="display:block;width:100%;margin-top:4px;" /></label><button type="button" data-action="choose-existing" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Choose File...</button></div><div data-field="existingFileStatus" style="font-size:11px;color:#4b4b4b;">No local file selected.</div></div><div style="display:flex;gap:10px;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert</button></div><div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div></form>`;

  const form = root.querySelector("form");
  const sourceEls = () => Array.from(root.querySelectorAll('input[name="nv-source"]'));
  const storageEls = () => Array.from(root.querySelectorAll('input[name="nv-storage"]'));
  const newSection = root.querySelector('[data-section="new"]');
  const existingSection = root.querySelector('[data-section="existing"]');
  const newRefSection = root.querySelector('[data-section="new-ref"]');
  const formatEl = root.querySelector('[data-field="format"]');
  const fileEl = root.querySelector('[data-field="fileName"]');
  const existingSourceEl = root.querySelector('[data-field="existingSource"]');
  const existingFileStatus = root.querySelector('[data-field="existingFileStatus"]');
  const statusEl = root.querySelector('[data-field="status"]');

  const hiddenExisting = document.createElement("input");
  hiddenExisting.type = "file";
  hiddenExisting.accept = options.map((e) => `.${e}`).join(",") || "";
  hiddenExisting.style.display = "none";
  form.appendChild(hiddenExisting);

  let existingLocal = { dataUrl: "", text: "", name: "" };
  const setStatus = (t) => { statusEl.textContent = String(t || ""); };
  const valueOf = (radios) => radios.find((r) => r.checked)?.value || "";

  const sync = () => {
    const src = valueOf(sourceEls());
    const storage = valueOf(storageEls());
    newSection.style.display = src === "new" ? "flex" : "none";
    existingSection.style.display = src === "existing" ? "flex" : "none";
    newRefSection.style.display = (src === "new" && storage === "referenced") ? "flex" : "none";
  };
  sourceEls().forEach((r) => r.addEventListener("change", sync));
  storageEls().forEach((r) => r.addEventListener("change", sync));
  sync();

  const updateExistingLabel = () => {
    existingFileStatus.textContent = existingLocal.dataUrl ? `Selected: ${existingLocal.name}` : "No local file selected.";
  };
  updateExistingLabel();

  root.querySelector('[data-action="choose-existing"]').addEventListener("click", () => hiddenExisting.click());
  hiddenExisting.addEventListener("change", async () => {
    const file = hiddenExisting.files?.[0];
    hiddenExisting.value = "";
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      let text = "";
      if (file.size <= 800_000) {
        try { text = await readFileAsText(file); } catch { text = ""; }
      }
      existingLocal = { dataUrl, text, name: file.name };
      existingSourceEl.value = file.name;
      existingSourceEl.dataset.localFile = "true";
    } catch (e) {
      existingLocal = { dataUrl: "", text: "", name: "" };
      delete existingSourceEl.dataset.localFile;
      setStatus(e?.message || String(e));
    }
    updateExistingLabel();
  });

  existingSourceEl.addEventListener("input", () => {
    if (existingSourceEl.dataset.localFile === "true" && existingSourceEl.value !== existingLocal.name) {
      existingLocal = { dataUrl: "", text: "", name: "" };
      delete existingSourceEl.dataset.localFile;
      updateExistingLabel();
    }
  });

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    setStatus("");
    try {
      const sourceMode = valueOf(sourceEls());
      const storageMode = valueOf(storageEls());
      const editorPath = getActiveEditorNotebookPath();
      const baseDir = dirname(editorPath);
      const defaultDir = joinNotebookPath(baseDir, "models");
      let html = "";
      let modelViewer = null;

      if (sourceMode === "new") {
        const ext = String(formatEl.value || defaultExt).trim().toLowerCase() || defaultExt;
        const fileName = ensureExt(fileEl.value || `model-${Date.now()}`, ext) || `model-${Date.now()}.${ext}`;
        const content = defaultModelContent(ext, fileName.replace(/\.[^.]+$/, ""));

        if (storageMode === "inline") {
          html = `<details class="nv-inline-model"><summary>${escapeHtml(fileName)}</summary><pre style="white-space:pre-wrap;">${escapeHtml(content)}</pre></details>`;
        } else {
          const notebookPath = normalizeNotebookPath(joinNotebookPath(defaultDir, fileName));
          await saveNotebookText(notebookPath, content, "text/plain");
          const href = notebookSourceFromPath(notebookPath, editorPath);
          modelViewer = { src: href, label: fileName, linkedPath: notebookPath, ext };
        }
      } else {
        const entered = String(existingSourceEl.value || "").trim();
        const localSelected = Boolean(existingLocal.dataUrl && existingSourceEl.dataset.localFile === "true");
        if (!entered && !localSelected) throw new Error("Enter an existing model source or choose a local file.");

        if (storageMode === "inline") {
          let text = "";
          if (localSelected) {
            text = existingLocal.text || "(Binary model selected; no text preview available.)";
          } else {
            const url = looksLikeUrlOrAbsPath(entered) ? entered : notebookHrefFromPath(normalizeNotebookPath(entered));
            text = await fetchUrlAsText(url);
          }
          if (text.length > 20000) text = text.slice(0, 20000) + "\n... (truncated)";
          const label = localSelected ? (existingLocal.name || "model") : (entered.split("/").pop() || entered);
          html = `<details class="nv-inline-model"><summary>${escapeHtml(label)}</summary><pre style="white-space:pre-wrap;">${escapeHtml(text)}</pre></details>`;
        } else if (localSelected) {
          const notebookPath = normalizeNotebookPath(entered) || normalizeNotebookPath(joinNotebookPath(defaultDir, existingLocal.name || `model-${Date.now()}.${defaultExt}`));
          await saveNotebookBinaryFromDataUrl(notebookPath, existingLocal.dataUrl, "application/octet-stream");
          const href = notebookSourceFromPath(notebookPath, editorPath);
          const label = notebookPath.split("/").pop() || notebookPath;
          modelViewer = { src: href, label, linkedPath: notebookPath, ext: modelExtensionFromSource(label, defaultExt) };
        } else if (notebookPathFromModelSource(entered)) {
          const notebookPath = notebookPathFromModelSource(entered);
          const href = notebookSourceFromPath(notebookPath, editorPath);
          const label = notebookPath.split("/").pop() || notebookPath;
          modelViewer = { src: href, label, linkedPath: notebookPath, ext: modelExtensionFromSource(label, defaultExt) };
        } else if (looksLikeUrlOrAbsPath(entered)) {
          const label = entered.split("/").pop() || entered;
          modelViewer = { src: entered, label, ext: modelExtensionFromSource(entered, defaultExt) };
        } else {
          const notebookPath = normalizeNotebookPath(entered);
          const href = notebookSourceFromPath(notebookPath, editorPath);
          const label = notebookPath.split("/").pop() || notebookPath;
          modelViewer = { src: href, label, linkedPath: notebookPath, ext: modelExtensionFromSource(label, defaultExt) };
        }
      }

      if (modelViewer) {
        const sceneExt = modelExtensionFromSource(modelViewer.src || modelViewer.label || "", modelViewer.ext || "");
        if (USD_SCENE_EXTENSIONS.has(sceneExt)) insertUSDScenePanelAtCaret(modelViewer);
        else insertLinkedModelViewerAtCaret(modelViewer);
      } else {
        insertHtmlAtCaret(html);
      }
      setStatus("Inserted.");
    } catch (err) {
      console.warn("[insertMediaModel]", err);
      setStatus(err?.message || String(err));
    }
  });
}


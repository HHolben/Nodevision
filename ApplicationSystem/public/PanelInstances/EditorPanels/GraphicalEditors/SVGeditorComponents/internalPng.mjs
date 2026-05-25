// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/internalPng.mjs
// Internal embedded PNG support for the ModuleMap-backed SVG editor.
import { pickLocalImageFile } from "/ToolbarJSONfiles/insertMediaCommon.mjs";
import { readFileAsDataUrl } from "/ToolbarJSONfiles/insertMediaIO.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const PNG_PREFIX = "data:image/png;base64,";
const LARGE_PNG_BYTES = 2 * 1024 * 1024;

export function getImageHref(el) {
  if (!el) return "";
  return el.getAttribute("href") || el.getAttributeNS?.(XLINK_NS, "href") || el.getAttribute("xlink:href") || "";
}

export function setImageHref(el, href) {
  if (!el) return;
  el.setAttribute("href", href);
  if (el.hasAttribute("xlink:href")) el.removeAttribute("xlink:href");
}

export function isInternalPng(el) {
  return String(el?.tagName || "").toLowerCase() === "image" && getImageHref(el).startsWith(PNG_PREFIX);
}

export function markInternalPngs(svgRoot) {
  Array.from(svgRoot?.querySelectorAll?.("image") || []).forEach((el) => {
    if (isInternalPng(el)) el.setAttribute("data-nodevision-internal-png", "true");
  });
}

function decodePng(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The PNG could not be decoded."));
    img.src = dataUrl;
  });
}

async function fileToPngDataUrl(file) {
  if (!file) return null;
  const name = String(file.name || "").toLowerCase();
  if (file.type && file.type !== "image/png") throw new Error("Please choose a PNG file.");
  if (!name.endsWith(".png")) throw new Error("Please choose a .png file.");
  if (file.size > LARGE_PNG_BYTES) {
    const mb = Math.round(file.size / 1024 / 1024);
    if (!window.confirm?.("Embed " + file.name + "? This PNG is " + mb + " MB and will make the SVG much larger.")) return null;
  }
  const dataUrl = await readFileAsDataUrl(file);
  if (!dataUrl.startsWith(PNG_PREFIX)) throw new Error("The selected file was not a valid base64 PNG.");
  await decodePng(dataUrl);
  return dataUrl;
}

function decodeImage(source) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = source;
  });
}

function fitNaturalSize(img, viewport) {
  const naturalWidth = img.naturalWidth || img.width || 100;
  const naturalHeight = img.naturalHeight || img.height || 100;
  const maxWidth = Math.max(1, viewport.width * 0.8);
  const maxHeight = Math.max(1, viewport.height * 0.8);
  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

async function saveNotebookImageFromDataUrl(notebookPath, dataUrl) {
  const parsed = /^data:([^;,]+)?;base64,(.*)$/i.exec(String(dataUrl || ""));
  if (!notebookPath || !parsed) throw new Error("Invalid PNG editor save request.");
  const res = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: notebookPath, content: parsed[2] || "", encoding: "base64", mimeType: parsed[1] || "image/png" }) });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  return notebookPath;
}

function temporaryInternalPngPath() {
  return `tmp/internal-png-edit-${Date.now()}-${Math.floor(Math.random() * 1e6)}.png`;
}

async function openInternalPngEditor({ el, setStatus, notifyChanged, markDirty }) {
  const source = getImageHref(el);
  if (!source.startsWith(PNG_PREFIX)) throw new Error("Select an internal PNG image first.");
  const tempPath = temporaryInternalPngPath();
  await saveNotebookImageFromDataUrl(tempPath, source);

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:1800;display:flex;align-items:center;justify-content:center;padding-top:calc(var(--nv-global-toolbar-height,40px) + var(--nv-sub-toolbar-height,0px));box-sizing:border-box;";
  const frame = document.createElement("div");
  frame.className = "panel nv-inline-embedded-panel";
  frame.style.cssText = "width:min(760px,94vw);height:min(560px,90vh);background:white;border:1px solid rgb(106,127,156);box-shadow:0 2px 10px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;";
  overlay.appendChild(frame);
  const header = document.createElement("div");
  header.className = "panel-header nv-inline-embedded-panel-header";
  header.style.cssText = "min-height:24px;height:24px;padding:0 6px;background:rgb(221,233,248);border-bottom:1px solid rgb(151,171,197);display:flex;align-items:center;justify-content:space-between;gap:6px;";
  const title = document.createElement("span");
  title.textContent = "Embedded Raster Editor";
  title.style.cssText = "font:11px monospace;color:rgb(21,50,79);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;align-items:center;gap:4px;";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  const finishBtn = document.createElement("button");
  finishBtn.type = "button";
  finishBtn.textContent = "Finish";
  controls.append(cancelBtn, finishBtn);
  header.append(title, controls);
  frame.appendChild(header);
  const host = document.createElement("div");
  host.style.cssText = "position:relative;flex:1;min-height:0;overflow:hidden;background:white;";
  frame.appendChild(host);
  document.body.appendChild(overlay);

  const previousMode = window.NodevisionState?.currentMode || "SVG Editing";
  const previousRasterCanvas = window.rasterCanvas || null;
  const previousPngEditorApi = window.__nvPngEditorApi || null;
  let editorCleanup = null;
  const close = async (applyChanges) => {
    try {
      if (applyChanges) {
        const canvas = host.querySelector("canvas") || window.rasterCanvas;
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error("PNG editor canvas was not available.");
        setImageHref(el, canvas.toDataURL("image/png"));
        el.setAttribute("data-nodevision-internal-png", "true");
        markDirty?.(true);
        notifyChanged?.("edit-internal-png");
        setStatus?.("Internal PNG updated.");
      }
    } finally {
      if (typeof editorCleanup === "function") {
        try { editorCleanup(); } catch (err) { console.warn("[internal-png] PNG editor cleanup failed", err); }
      }
      window.rasterCanvas = previousRasterCanvas;
      window.__nvPngEditorApi = previousPngEditorApi;
      window.NodevisionState = window.NodevisionState || {};
      window.NodevisionState.currentMode = previousMode;
      updateToolbarState({ currentMode: previousMode, svgImageSelected: true });
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  };
  cancelBtn.addEventListener("click", () => { void close(false); });
  finishBtn.addEventListener("click", () => { void close(true); });
  try {
    const mod = await import("/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs");
    if (typeof mod.renderEditor !== "function") throw new Error("PNG editor module missing renderEditor().");
    const instance = await mod.renderEditor(tempPath, host);
    if (instance && typeof instance.destroy === "function") editorCleanup = instance.destroy;
    const canvas = host.querySelector("canvas");
    if (canvas instanceof HTMLCanvasElement) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
    }
    setStatus?.("Editing internal PNG.");
    return true;
  } catch (err) {
    await close(false);
    throw err;
  }
}

function buildCropModal({ el, img, setStatus, notifyChanged }) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:2000;display:flex;align-items:center;justify-content:center;";
  const modal = document.createElement("div");
  modal.style.cssText = "background:#fff;border:1px solid #bbb;border-radius:8px;padding:14px;display:grid;gap:10px;max-width:min(720px,90vw);max-height:90vh;overflow:auto;";
  overlay.appendChild(modal);

  const title = document.createElement("div");
  title.textContent = "Edit Internal PNG";
  title.style.fontWeight = "700";
  modal.appendChild(title);

  const canvas = document.createElement("canvas");
  const naturalWidth = img.naturalWidth || img.width || 1;
  const naturalHeight = img.naturalHeight || img.height || 1;
  const previewScale = Math.min(1, 480 / Math.max(naturalWidth, naturalHeight));
  canvas.width = Math.max(1, Math.round(naturalWidth * previewScale));
  canvas.height = Math.max(1, Math.round(naturalHeight * previewScale));
  canvas.style.cssText = "border:1px solid #ccc;max-width:100%;image-rendering:auto;";
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  modal.appendChild(canvas);

  const fields = document.createElement("div");
  fields.style.cssText = "display:grid;grid-template-columns:repeat(4,minmax(70px,1fr));gap:8px;";
  const inputs = {};
  [["x", 0], ["y", 0], ["width", naturalWidth], ["height", naturalHeight]].forEach(([key, value]) => {
    const label = document.createElement("label");
    label.style.cssText = "display:grid;gap:4px;font-size:12px;";
    label.textContent = key;
    const input = document.createElement("input");
    input.type = "number";
    input.min = key === "width" || key === "height" ? "1" : "0";
    input.step = "1";
    input.value = String(value);
    input.style.cssText = "padding:6px;border:1px solid #bbb;border-radius:6px;";
    label.appendChild(input);
    inputs[key] = input;
    fields.appendChild(label);
  });
  modal.appendChild(fields);

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  const apply = document.createElement("button");
  apply.type = "button";
  apply.textContent = "Apply Crop";
  buttons.append(cancel, apply);
  modal.appendChild(buttons);

  cancel.addEventListener("click", () => overlay.remove());
  apply.addEventListener("click", () => {
    const sx = Math.max(0, Number.parseInt(inputs.x.value, 10) || 0);
    const sy = Math.max(0, Number.parseInt(inputs.y.value, 10) || 0);
    const sw = Math.max(1, Number.parseInt(inputs.width.value, 10) || 1);
    const sh = Math.max(1, Number.parseInt(inputs.height.value, 10) || 1);
    const out = document.createElement("canvas");
    out.width = Math.min(sw, naturalWidth - sx);
    out.height = Math.min(sh, naturalHeight - sy);
    if (out.width < 1 || out.height < 1) {
      setStatus?.("Crop bounds are outside the PNG.");
      return;
    }
    out.getContext("2d")?.drawImage(img, sx, sy, out.width, out.height, 0, 0, out.width, out.height);
    setImageHref(el, out.toDataURL("image/png"));
    el.setAttribute("data-nodevision-internal-png", "true");
    notifyChanged?.("edit-internal-png");
    overlay.remove();
    setStatus?.("Internal PNG crop applied.");
  });

  document.body.appendChild(overlay);
}

export function createInternalPngController({
  svgRoot,
  getViewBox,
  appendElement,
  getSelectedElement,
  setStatus,
  notifyChanged,
  markDirty,
} = {}) {
  const controller = {
    pngPrefix: PNG_PREFIX,
    getImageHref,
    setImageHref,
    isInternalPng,
    markInternalPngs: () => markInternalPngs(svgRoot),
    async insertImageFromInsertion(insertion = {}) {
      try {
        const src = String(insertion.src || "").trim();
        if (!src) throw new Error("No image source was provided.");
        const img = await decodeImage(src);
        const viewport = getViewBox?.() || { x: 0, y: 0, width: 800, height: 600 };
        const size = img
          ? fitNaturalSize(img, viewport)
          : { width: Math.max(1, Math.round(viewport.width * 0.35)), height: Math.max(1, Math.round(viewport.height * 0.35)) };
        const el = document.createElementNS(SVG_NS, "image");
        el.setAttribute("x", String(Math.round(viewport.x + (viewport.width - size.width) / 2)));
        el.setAttribute("y", String(Math.round(viewport.y + (viewport.height - size.height) / 2)));
        el.setAttribute("width", String(size.width));
        el.setAttribute("height", String(size.height));
        setImageHref(el, src);
        if (src.startsWith(PNG_PREFIX)) el.setAttribute("data-nodevision-internal-png", "true");
        if (insertion.linkedNotebookPath) {
          el.setAttribute("data-nv-linked-path", String(insertion.linkedNotebookPath));
        }
        if (insertion.sourceName) {
          el.setAttribute("data-nodevision-source-name", String(insertion.sourceName));
        }
        appendElement?.(el);
        markDirty?.(true);
        notifyChanged?.("insert-image");
        setStatus?.("Image inserted: " + (insertion.sourceName || "image"));
        return el;
      } catch (err) {
        console.error("[internal-png] image insert failed", err);
        setStatus?.(err?.message || "Could not insert image.");
        return null;
      }
    },
    async insertInternalPng() {
      try {
        const file = await pickLocalImageFile({ accept: "image/png,.png" });
        if (!file) return null;
        const dataUrl = await fileToPngDataUrl(file);
        if (!dataUrl) return null;
        const img = await decodePng(dataUrl);
        const viewport = getViewBox?.() || { x: 0, y: 0, width: 800, height: 600 };
        const size = fitNaturalSize(img, viewport);
        const el = document.createElementNS(SVG_NS, "image");
        el.setAttribute("x", String(Math.round(viewport.x + (viewport.width - size.width) / 2)));
        el.setAttribute("y", String(Math.round(viewport.y + (viewport.height - size.height) / 2)));
        el.setAttribute("width", String(size.width));
        el.setAttribute("height", String(size.height));
        setImageHref(el, dataUrl);
        el.setAttribute("data-nodevision-internal-png", "true");
        el.setAttribute("data-nodevision-source-name", file.name || "embedded.png");
        appendElement?.(el);
        markDirty?.(true);
        notifyChanged?.("insert-internal-png");
        setStatus?.(`Embedded PNG inserted: ${file.name || "image.png"}`);
        return el;
      } catch (err) {
        console.error("[internal-png] insert failed", err);
        setStatus?.(err?.message || "Could not insert PNG.");
        return null;
      }
    },
    async replaceSelectedPng() {
      try {
        const el = getSelectedElement?.();
        if (!isInternalPng(el)) throw new Error("Select an internal PNG image first.");
        const file = await pickLocalImageFile({ accept: "image/png,.png" });
        if (!file) return false;
        const dataUrl = await fileToPngDataUrl(file);
        if (!dataUrl) return false;
        setImageHref(el, dataUrl);
        el.setAttribute("data-nodevision-internal-png", "true");
        el.setAttribute("data-nodevision-source-name", file.name || "embedded.png");
        markDirty?.(true);
        notifyChanged?.("replace-internal-png");
        setStatus?.(`Embedded PNG replaced: ${file.name || "image.png"}`);
        return true;
      } catch (err) {
        console.error("[internal-png] replace failed", err);
        setStatus?.(err?.message || "Could not replace PNG.");
        return false;
      }
    },
    exportSelectedPng() {
      try {
        const el = getSelectedElement?.();
        if (!isInternalPng(el)) throw new Error("Select an internal PNG image first.");
        const a = document.createElement("a");
        const name = el.getAttribute("data-nodevision-source-name") || "nodevision-embedded.png";
        a.href = getImageHref(el);
        a.download = name.toLowerCase().endsWith(".png") ? name : `${name}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatus?.(`PNG exported: ${a.download}`);
        return true;
      } catch (err) {
        setStatus?.(err?.message || "Could not export PNG.");
        return false;
      }
    },
    async editSelectedPng() {
      try {
        const el = getSelectedElement?.();
        if (!isInternalPng(el)) throw new Error("Select an internal PNG image first.");
        return await openInternalPngEditor({
          el,
          setStatus,
          notifyChanged,
          markDirty,
        });
      } catch (err) {
        console.error("[internal-png] edit failed", err);
        setStatus?.(err?.message || "Could not edit PNG.");
        return false;
      }
    },
  };

  markInternalPngs(svgRoot);
  window.NVInternalPng = controller;
  return controller;
}

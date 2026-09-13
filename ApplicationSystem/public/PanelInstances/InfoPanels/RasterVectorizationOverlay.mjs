// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/RasterVectorizationOverlay.mjs
// This overlay panel lets a PNG viewer derive a new SVG through the shared raster vectorization service. It previews original, processed, and vector output while keeping file creation behind Nodevision notebook save workflows.

import { processedImageDataToDataUrl, scheduleVectorizationPreview, vectorizeRaster } from "/RasterVectorization/RasterVectorizationService.mjs";
import { derivedSvgPath, openSvgInGraphicalEditor, saveDerivedSvg } from "/RasterVectorization/RasterVectorizationWorkflow.mjs";

function labeled(host, text, input) {
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = text;
  label.className = "nv-rv-control";
  label.append(span, input);
  host.appendChild(label);
}

function slider(name, min, max, value) {
  const input = document.createElement("input");
  input.type = "range"; input.name = name; input.min = min; input.max = max; input.value = value;
  return input;
}

function checkbox(name, checked) {
  const input = document.createElement("input");
  input.type = "checkbox"; input.name = name; input.checked = checked;
  return input;
}

function currentOptions(form) {
  return { mode: form.mode.value, threshold: Number(form.threshold.value), contrast: Number(form.contrast.value), cleanup: Number(form.cleanup.value), simplification: Number(form.simplification.value), boldness: Number(form.boldness.value), invert: form.invert.checked, colorizeFromSource: form.colorizeFromSource.checked, preserveAlpha: form.preserveAlpha.checked, colorMaxColors: Number(form.colorMaxColors.value), regionMinArea: Number(form.regionMinArea.value), backgroundPolicy: form.backgroundPolicy.value };
}

function statsText(stats = {}) {
  return `Paths: ${stats.paths || 0} - Nodes: ${stats.nodes || 0} - Size: ${Math.round((stats.estimatedSvgBytes || 0) / 1024)} KB`;
}

function addStyles() {
  if (document.getElementById("nv-raster-vectorization-style")) return;
  const style = document.createElement("style");
  style.id = "nv-raster-vectorization-style";
  style.textContent = `.nv-rv{display:grid;grid-template-rows:auto 1fr auto;gap:10px;height:100%;padding:12px;box-sizing:border-box;font:13px system-ui,sans-serif}.nv-rv-main{display:grid;grid-template-columns:220px 1fr;gap:10px;min-height:0}.nv-rv-controls{display:grid;align-content:start;gap:8px}.nv-rv-control{display:grid;gap:3px}.nv-rv-control span{font-size:12px;color:#475569}.nv-rv-preview{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;min-width:0;min-height:0}.nv-rv-pane{display:grid;grid-template-rows:auto 1fr;border:1px solid #cbd5e1;background:#fff;min-width:0;min-height:0}.nv-rv-pane h3{margin:0;padding:5px 7px;font-size:12px;background:#e2e8f0}.nv-rv-pane img,.nv-rv-pane iframe{width:100%;height:100%;object-fit:contain;border:0;min-height:0}.nv-rv-actions{display:flex;justify-content:space-between;gap:8px;align-items:center}.nv-rv-actions button{padding:7px 10px;border:1px solid #64748b;background:#fff;border-radius:5px;cursor:pointer}.nv-rv-actions .primary{background:#0078d7;color:#fff;border-color:#006fbe}`;
  document.head.appendChild(style);
}

function pane(title, child) {
  const box = document.createElement("section");
  box.className = "nv-rv-pane";
  const h = document.createElement("h3");
  h.textContent = title;
  box.append(h, child);
  return box;
}

function buildControls(form) {
  form.className = "nv-rv-controls";
  form.appendChild(document.createElement("strong")).textContent = "Source Processing";
  const mode = document.createElement("select"); mode.name = "mode"; mode.innerHTML = `<option value="line">Line Drawing</option><option value="woodcut">Woodcut</option><option value="color">Color Region</option>`;
  labeled(form, "Mode", mode); labeled(form, "Threshold", slider("threshold", 0, 255, 150)); labeled(form, "Contrast", slider("contrast", -100, 100, 20));
  form.appendChild(document.createElement("strong")).textContent = "Drawing Cleanup";
  labeled(form, "Noise cleanup", slider("cleanup", 0, 8, 1)); labeled(form, "Boldness", slider("boldness", -3, 3, 0)); labeled(form, "Invert", checkbox("invert", false));
  form.appendChild(document.createElement("strong")).textContent = "Vector Output";
  labeled(form, "Simplification", slider("simplification", 0, 100, 30));
  form.appendChild(document.createElement("strong")).textContent = "Color";
  labeled(form, "Colorize from source", checkbox("colorizeFromSource", false));
  labeled(form, "Preserve transparency", checkbox("preserveAlpha", true));
  labeled(form, "Maximum colors", slider("colorMaxColors", 4, 32, 12));
  labeled(form, "Minimum region size", slider("regionMinArea", 1, 120, 12));
  const background = document.createElement("select"); background.name = "backgroundPolicy";
  background.innerHTML = `<option value="preserve">Preserve background</option><option value="remove-light">Remove light background</option><option value="remove-dark">Remove dark background</option>`;
  labeled(form, "Background", background);
}

export function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  addStyles();
  const imageData = panelVars.imageData;
  const sourcePath = panelVars.sourcePath || "image.png";
  const title = panelRoot?.querySelector(".panel-title");
  if (title) title.textContent = "Vectorize: " + sourcePath.split("/").pop();
  contentElem.replaceChildren();
  const root = document.createElement("div"); root.className = "nv-rv";
  const intro = document.createElement("div"); intro.textContent = "Original PNG will not be modified. A new SVG file will be created.";
  const main = document.createElement("div"); main.className = "nv-rv-main";
  const form = document.createElement("form"); buildControls(form);
  const original = document.createElement("img"); original.src = processedImageDataToDataUrl(imageData);
  const processed = document.createElement("img"); const vector = document.createElement("iframe");
  const preview = document.createElement("div"); preview.className = "nv-rv-preview"; preview.append(pane("Original", original), pane("Processed Raster", processed), pane("Vector Preview", vector));
  main.append(form, preview);
  const actions = document.createElement("div"); actions.className = "nv-rv-actions";
  const stats = document.createElement("span"); const cancel = document.createElement("button"); const create = document.createElement("button"); const open = document.createElement("button");
  cancel.type = "button"; create.type = "button"; open.type = "button";
  cancel.textContent = "Cancel"; create.textContent = "Create SVG"; open.textContent = "Create and Open"; open.className = "primary";
  actions.append(stats, cancel, create, open); root.append(intro, main, actions); contentElem.appendChild(root);
  let cancelPreview = null;
  const update = () => { cancelPreview?.(); cancelPreview = scheduleVectorizationPreview(imageData, currentOptions(form), (err, result) => { if (err) { stats.textContent = err.message; return; } processed.src = processedImageDataToDataUrl(result.processedImageData); vector.srcdoc = result.svg; stats.textContent = statsText(result.statistics); }); };
  form.addEventListener("input", update); update();
  cancel.addEventListener("click", () => panelVars.onCancel?.());
  async function finish(openAfter) {
    create.disabled = true; open.disabled = true; stats.textContent = "Creating SVG...";
    try {
      const full = vectorizeRaster(imageData, { ...currentOptions(form), title: sourcePath });
      const target = await saveDerivedSvg({ sourcePath, preferredPath: derivedSvgPath(sourcePath), svg: full.svg });
      if (openAfter) openSvgInGraphicalEditor(target);
      panelVars.onDone?.({ targetPath: target, statistics: full.statistics });
    } catch (error) {
      stats.textContent = error?.message || "Could not create SVG.";
      create.disabled = false; open.disabled = false;
    }
  }
  create.addEventListener("click", () => finish(false)); open.addEventListener("click", () => finish(true));
}

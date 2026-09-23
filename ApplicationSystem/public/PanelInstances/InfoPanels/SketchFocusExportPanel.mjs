// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SketchFocusExportPanel.mjs
// This overlay panel collects the format, export options, and basename used by the Sketch Focus Session finish workflow.

const STYLE_ID = "nv-sketch-focus-export-panel-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-sketch-export-panel { display: grid; gap: 14px; padding: 18px; color: #111; background: #f1f1ee; font: 14px system-ui, sans-serif; }
.nv-sketch-export-panel h2 { margin: 0; font-size: 17px; }
.nv-sketch-export-panel label { display: grid; gap: 5px; font-weight: 650; }
.nv-sketch-export-panel select,
.nv-sketch-export-panel input { box-sizing: border-box; width: 100%; border: 1px solid #777; border-radius: 5px; padding: 8px 9px; background: #fafafa; color: #111; font: inherit; }
.nv-sketch-title-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: center; }
.nv-sketch-title-row span { color: #333; font: 700 14px ui-monospace, monospace; }
.nv-sketch-export-error { min-height: 18px; color: #7a1111; }
.nv-sketch-export-actions { display: flex; justify-content: flex-end; gap: 8px; }
.nv-sketch-export-actions button { border: 1px solid #666; border-radius: 6px; padding: 8px 12px; background: #fafafa; color: #111; cursor: pointer; font: inherit; }
.nv-sketch-export-actions .primary { background: #222; color: #f4f4f1; }
`;
  document.head.appendChild(style);
}

export function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  ensureStyles();
  const title = panelRoot?.querySelector(".panel-title");
  if (title) title.textContent = panelVars.title || "Sketch Focus";
  contentElem.replaceChildren();
  const stage = String(panelVars.stage || "format");
  const form = document.createElement("form");
  form.className = "nv-sketch-export-panel";
  const error = document.createElement("div");
  error.className = "nv-sketch-export-error";
  form.appendChild(heading(stage));
  if (stage === "format") appendFormat(form, panelVars);
  else if (stage === "options") appendOptions(form, panelVars);
  else appendTitle(form, panelVars);
  form.appendChild(error);
  form.appendChild(actions(panelVars));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = payloadFor(stage, form, panelVars);
    if (payload.error) {
      error.textContent = payload.error;
      return;
    }
    panelVars.onDone?.(payload);
  });
  contentElem.appendChild(form);
  requestAnimationFrame(() => form.querySelector("select,input,button")?.focus());
}

function heading(stage) {
  const h = document.createElement("h2");
  h.textContent = stage === "format" ? "Choose output format" : stage === "options" ? "Choose export options" : "Title the drawing";
  return h;
}

function appendFormat(form, panelVars) {
  const label = document.createElement("label");
  label.textContent = "Format";
  const select = document.createElement("select");
  select.name = "format";
  for (const format of ["SVG", "PNG", "JPG", "GIF"]) {
    const option = document.createElement("option");
    option.value = format.toLowerCase();
    option.textContent = format;
    if (option.value === String(panelVars.format || "png").toLowerCase()) option.selected = true;
    select.appendChild(option);
  }
  label.appendChild(select);
  form.appendChild(label);
}

function appendOptions(form, panelVars) {
  const format = String(panelVars.format || "png").toLowerCase();
  if (format === "svg") appendSelect(form, "svgProfile", "SVG profile", [["faithful", "Faithful"], ["balanced", "Balanced"], ["compact", "Compact"]], "balanced");
  if (format === "png") {
    appendSelect(form, "scale", "Resolution scale", [["1", "1x"], ["2", "2x"], ["3", "3x"]], "1");
    appendSelect(form, "grayLevels", "Gray levels", [["256", "Full 8-bit grayscale"], ["64", "64"], ["16", "16"], ["4", "4"], ["2", "2"]], "256");
  }
  if (format === "jpg") {
    appendSelect(form, "scale", "Resolution scale", [["1", "1x"], ["2", "2x"], ["3", "3x"]], "1");
    appendRange(form, "quality", "JPEG quality", 0.5, 1, 0.01, 0.9);
  }
  if (format === "gif") {
    appendSelect(form, "scale", "Resolution scale", [["1", "1x"], ["2", "2x"], ["3", "3x"]], "1");
    appendSelect(form, "grayLevels", "Palette gray levels", [["2", "2"], ["4", "4"], ["16", "16"], ["64", "64"], ["256", "256"]], "256");
  }
}

function appendTitle(form, panelVars) {
  const label = document.createElement("label");
  label.textContent = "Basename";
  const row = document.createElement("div");
  row.className = "nv-sketch-title-row";
  const input = document.createElement("input");
  input.name = "basename";
  input.value = stripExtension(panelVars.basename || "Untitled Sketch", panelVars.extension || "");
  input.autocomplete = "off";
  const suffix = document.createElement("span");
  suffix.textContent = "." + String(panelVars.extension || "png");
  row.append(input, suffix);
  label.appendChild(row);
  form.appendChild(label);
}

function appendSelect(form, name, text, options, selected) {
  const label = document.createElement("label");
  label.textContent = text;
  const select = document.createElement("select");
  select.name = name;
  for (const [value, optionText] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = optionText;
    if (String(value) === String(selected)) option.selected = true;
    select.appendChild(option);
  }
  label.appendChild(select);
  form.appendChild(label);
}

function appendRange(form, name, text, min, max, step, value) {
  const label = document.createElement("label");
  label.textContent = text;
  const input = document.createElement("input");
  Object.assign(input, { name, type: "range", min: String(min), max: String(max), step: String(step), value: String(value) });
  label.appendChild(input);
  form.appendChild(label);
}

function actions(panelVars) {
  const wrap = document.createElement("div");
  wrap.className = "nv-sketch-export-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => panelVars.onCancel?.());
  const next = document.createElement("button");
  next.type = "submit";
  next.className = "primary";
  next.textContent = panelVars.submitLabel || "Next";
  wrap.append(cancel, next);
  return wrap;
}

function payloadFor(stage, form, panelVars) {
  const data = new FormData(form);
  if (stage === "format") return { format: String(data.get("format") || "png") };
  if (stage === "title") {
    const basename = sanitizeBasename(data.get("basename"), panelVars.extension);
    return basename ? { basename } : { error: "Use a filename without slashes." };
  }
  return {
    scale: Number(data.get("scale") || 1),
    grayLevels: Number(data.get("grayLevels") || 256),
    quality: Number(data.get("quality") || 0.9),
    svgProfile: String(data.get("svgProfile") || "balanced"),
  };
}

function stripExtension(value, extension) {
  const ext = String(extension || "").replace(/^\./, "");
  return String(value || "").replace(new RegExp(`\\.${ext}$`, "i"), "");
}

export function sanitizeBasename(value, extension) {
  const ext = String(extension || "").replace(/^\./, "");
  return stripExtension(String(value || "").trim(), ext).replace(/[\\/:*?"<>|]+/g, "-").replace(/^\.+/, "").trim();
}

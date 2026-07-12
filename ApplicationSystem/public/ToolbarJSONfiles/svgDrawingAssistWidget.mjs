// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/svgDrawingAssistWidget.mjs
// Sub-toolbar controls for SVG brush, stabilization, shape correction, and quick drawing gestures.

const SVG_MODE = "SVG Editing";

function ctx() {
  return window.SVGEditorContext || null;
}

function makeLabel(text) {
  const label = document.createElement("label");
  Object.assign(label.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "12px",
    whiteSpace: "nowrap",
  });
  const span = document.createElement("span");
  span.textContent = text;
  label.appendChild(span);
  return label;
}

function styleControl(el, width = "86px") {
  Object.assign(el.style, {
    height: "24px",
    width,
    fontSize: "12px",
    border: "1px solid #c7c7c7",
    borderRadius: "6px",
    background: "#fff",
  });
  return el;
}

function numberInput(value, { min = "0", max = "", step = "1", width = "64px" } = {}) {
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  input.min = min;
  if (max !== "") input.max = max;
  input.step = step;
  return styleControl(input, width);
}

function checkbox(value) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  Object.assign(input.style, { width: "16px", height: "16px" });
  return input;
}

function select(options, value, width = "116px") {
  const el = document.createElement("select");
  options.forEach(({ value: optValue, label }) => {
    const opt = document.createElement("option");
    opt.value = optValue;
    opt.textContent = label;
    el.appendChild(opt);
  });
  el.value = value;
  return styleControl(el, width);
}

function updateSettings(patch) {
  const api = ctx();
  if (!api?.setDrawingAssistSettings) return null;
  return api.setDrawingAssistSettings(patch);
}

function renderRecentSizes(container, settings) {
  container.innerHTML = "";
  const sizes = Array.isArray(settings.recentBrushSizes) ? settings.recentBrushSizes : [];
  sizes.slice(-6).forEach((size) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(size);
    btn.title = "Use recent brush size";
    Object.assign(btn.style, { minWidth: "30px", height: "24px" });
    btn.onclick = () => updateSettings({ brushSize: size });
    container.appendChild(btn);
  });
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  if (typeof hostElement.__nvCleanupSvgDrawingAssistWidget === "function") {
    hostElement.__nvCleanupSvgDrawingAssistWidget();
  }
  hostElement.innerHTML = "";

  const root = document.createElement("div");
  Object.assign(root.style, {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    flexWrap: "wrap",
    padding: "2px 0",
  });
  hostElement.appendChild(root);

  const api = ctx();
  if (!api) {
    const msg = document.createElement("span");
    msg.textContent = "Open an SVG editor to show drawing controls.";
    root.appendChild(msg);
    return;
  }

  const settings = api.getDrawingAssistSettings?.() || {};
  const presets = api.getBrushPresets?.() || [];

  const presetLabel = makeLabel("Brush");
  const preset = select(
    presets.map((p) => ({ value: p.id, label: p.name || p.id })),
    settings.defaultBrushPreset || "monoline",
    "132px",
  );
  preset.title = "Vector brush preset";
  preset.onchange = () => updateSettings({ defaultBrushPreset: preset.value });
  presetLabel.appendChild(preset);
  root.appendChild(presetLabel);

  const sizeLabel = makeLabel("Size");
  const size = numberInput(settings.brushSize || 6, { min: "0.1", step: "0.5", width: "62px" });
  size.title = "Brush size in SVG units. Use [ and ] on the canvas for quick changes.";
  size.onchange = () => updateSettings({ brushSize: size.value });
  sizeLabel.appendChild(size);
  root.appendChild(sizeLabel);

  const opacityLabel = makeLabel("Opacity");
  const opacity = numberInput(settings.brushOpacity || 1, { min: "0.01", max: "1", step: "0.05", width: "58px" });
  opacity.title = "Brush opacity";
  opacity.onchange = () => updateSettings({ brushOpacity: opacity.value });
  opacityLabel.appendChild(opacity);
  root.appendChild(opacityLabel);

  const modeLabel = makeLabel("Stabilize");
  const mode = select([
    { value: "none", label: "None" },
    { value: "light", label: "Light" },
    { value: "medium", label: "Medium" },
    { value: "strong", label: "Strong" },
    { value: "technical", label: "Technical" },
    { value: "delayed-rope", label: "Delayed Rope" },
  ], settings.stabilizationMode || "light", "122px");
  mode.title = "Freehand stabilization mode";
  mode.onchange = () => updateSettings({ stabilizationMode: mode.value });
  modeLabel.appendChild(mode);
  root.appendChild(modeLabel);

  const strengthLabel = makeLabel("Strength");
  const strength = numberInput(settings.stabilizationStrength || 0.35, { min: "0", max: "1", step: "0.05", width: "58px" });
  strength.title = "Stabilization strength";
  strength.onchange = () => updateSettings({ stabilizationStrength: strength.value });
  strengthLabel.appendChild(strength);
  root.appendChild(strengthLabel);

  const smoothingLabel = makeLabel("Smooth");
  const smoothing = numberInput(settings.smoothing || 0.32, { min: "0", max: "1", step: "0.05", width: "58px" });
  smoothing.title = "Stroke smoothing";
  smoothing.onchange = () => updateSettings({ smoothing: smoothing.value });
  smoothingLabel.appendChild(smoothing);
  root.appendChild(smoothingLabel);

  const minLabel = makeLabel("Min Dist");
  const minDist = numberInput(settings.minimumPointDistance || 0.35, { min: "0", step: "0.05", width: "58px" });
  minDist.title = "Minimum point distance in SVG units";
  minDist.onchange = () => updateSettings({ minimumPointDistance: minDist.value });
  minLabel.appendChild(minDist);
  root.appendChild(minLabel);

  const simplifyLabel = makeLabel("Simplify");
  const simplify = numberInput(settings.curveSimplification || 0.65, { min: "0", step: "0.05", width: "58px" });
  simplify.title = "Final curve simplification";
  simplify.onchange = () => updateSettings({ curveSimplification: simplify.value });
  simplifyLabel.appendChild(simplify);
  root.appendChild(simplifyLabel);

  [
    ["Corners", "preserveCorners", "Preserve intentional corners"],
    ["Live", "livePreview", "Show live stabilized preview"],
    ["Shape", "shapeCorrectionEnabled", "Enable draw-and-hold shape correction"],
    ["Cursor", "showBrushCursor", "Show circular brush cursor"],
  ].forEach(([labelText, key, title]) => {
    const label = makeLabel(labelText);
    const input = checkbox(settings[key]);
    input.title = title;
    input.onchange = () => updateSettings({ [key]: input.checked });
    label.appendChild(input);
    root.appendChild(label);
  });

  const recent = document.createElement("div");
  Object.assign(recent.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  });
  recent.title = "Recently used brush sizes";
  renderRecentSizes(recent, settings);
  root.appendChild(recent);

  const quickBtn = document.createElement("button");
  quickBtn.type = "button";
  quickBtn.textContent = "QuickMenu";
  quickBtn.title = "Open QuickMenu near the last pointer location";
  quickBtn.onclick = () => api.showQuickMenu?.();
  root.appendChild(quickBtn);

  const refresh = () => {
    if ((window.NodevisionState?.currentMode || "") !== SVG_MODE) return;
    const next = api.getDrawingAssistSettings?.() || {};
    if (document.activeElement !== size) size.value = String(next.brushSize || 6);
    if (document.activeElement !== opacity) opacity.value = String(next.brushOpacity || 1);
    renderRecentSizes(recent, next);
  };
  window.addEventListener("nv-svg-drawing-assist-settings-changed", refresh);
  hostElement.__nvCleanupSvgDrawingAssistWidget = () => {
    window.removeEventListener("nv-svg-drawing-assist-settings-changed", refresh);
  };
}

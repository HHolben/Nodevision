// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/sketchPredictionModeWidget.mjs
// Pencil Sketch prediction mode selector and curve refinement actions.

const IRREGULAR_SHAPE_AVERAGING_MODE = "irregular-shape-averaging";
const IRREGULAR_SHAPE_OVERRIDING_MODE = "irregular-shape-overriding";

const MODE_OPTIONS = [
  { value: "raw", label: "Raw Pencil" },
  { value: "shape", label: "Shape Sketch" },
  { value: "curve", label: "Curve Sketch" },
  { value: "function-curve", label: "Function Curve" },
  { value: IRREGULAR_SHAPE_AVERAGING_MODE, label: "Irregular shape: averaging" },
  { value: IRREGULAR_SHAPE_OVERRIDING_MODE, label: "Irregular shape: overriding" },
];

function getSketchContext() {
  return window.SVGEditorContext || null;
}

function normalizeMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "raw" || mode === "raw-pencil") return "raw";
  if (mode === "curve") return "curve";
  if (mode === "function" || mode === "function-curve" || mode === "graph" || mode === "graph-curve") {
    return "function-curve";
  }
  if (
    mode === "irregular" ||
    mode === "irregular-shape" ||
    mode === "irregular shape" ||
    mode === "irregular-shape-averaging" ||
    mode === "irregular shape: averaging" ||
    mode === "blob" ||
    mode === "radial-shape"
  ) {
    return IRREGULAR_SHAPE_AVERAGING_MODE;
  }
  if (
    mode === "irregular-shape-overriding" ||
    mode === "irregular shape: overriding" ||
    mode === "irregular-overriding"
  ) {
    return IRREGULAR_SHAPE_OVERRIDING_MODE;
  }
  return "shape";
}

function isIrregularMode(mode) {
  const next = normalizeMode(mode);
  return next === IRREGULAR_SHAPE_AVERAGING_MODE || next === IRREGULAR_SHAPE_OVERRIDING_MODE;
}

function mirrorKeys(axis) {
  const normalized = String(axis || "").trim().toLowerCase();
  return normalized === "y"
    ? { stateKey: "sketchMirrorY", settingsKey: "irregularMirrorY", getter: "getSketchMirrorY", setter: "setSketchMirrorY" }
    : { stateKey: "sketchMirrorX", settingsKey: "irregularMirrorX", getter: "getSketchMirrorX", setter: "setSketchMirrorX" };
}

function readMode() {
  const ctx = getSketchContext();
  if (typeof ctx?.getSketchPredictionMode === "function") {
    return normalizeMode(ctx.getSketchPredictionMode());
  }
  return normalizeMode(
    window.NodevisionSketchSettings?.predictionMode ||
      window.NodevisionState?.sketchPredictionMode ||
      "shape",
  );
}

function writeMode(mode) {
  const next = normalizeMode(mode);
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.sketchPredictionMode = next;
  window.NodevisionSketchSettings = window.NodevisionSketchSettings || {};
  window.NodevisionSketchSettings.predictionMode = next;
  getSketchContext()?.setSketchPredictionMode?.(next);
  return next;
}

function readMirror(axis) {
  const keys = mirrorKeys(axis);
  const ctx = getSketchContext();
  if (typeof ctx?.[keys.getter] === "function") {
    return Boolean(ctx[keys.getter]());
  }
  const stateValue = window.NodevisionState?.[keys.stateKey];
  if (typeof stateValue === "boolean") return stateValue;
  const settingsValue = window.NodevisionSketchSettings?.[keys.settingsKey];
  if (typeof settingsValue === "boolean") return settingsValue;
  return false;
}

function writeMirror(axis, value) {
  const keys = mirrorKeys(axis);
  const next = Boolean(value);
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState[keys.stateKey] = next;
  window.NodevisionSketchSettings = window.NodevisionSketchSettings || {};
  window.NodevisionSketchSettings[keys.settingsKey] = next;
  const ctx = getSketchContext();
  if (typeof ctx?.[keys.setter] === "function") {
    return Boolean(ctx[keys.setter](next));
  }
  return next;
}

function styleButton(button) {
  Object.assign(button.style, {
    border: "1px solid #9ba7b5",
    background: "#f7f9fb",
    color: "#1f2933",
    borderRadius: "4px",
    padding: "3px 6px",
    fontSize: "11px",
    lineHeight: "1.2",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });
}

function actionButton(label, title, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  styleButton(button);
  button.addEventListener("click", () => {
    const ctx = getSketchContext();
    if (!ctx || typeof ctx[action] !== "function") return;
    ctx[action]();
  });
  return button;
}

function styleMirrorLabel(label) {
  Object.assign(label.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    color: "var(--nv-toolbar-dropdown-text, #704214)",
    whiteSpace: "nowrap",
    userSelect: "none",
  });
}

function mirrorCheckbox(text, axis) {
  const label = document.createElement("label");
  styleMirrorLabel(label);
  const input = document.createElement("input");
  input.type = "checkbox";
  input.title = text + " irregular sketches around the focal point";
  input.checked = readMirror(axis);
  input.addEventListener("change", () => {
    input.checked = writeMirror(axis, input.checked);
  });
  const span = document.createElement("span");
  span.textContent = text;
  label.append(input, span);
  return { label, input };
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = "";

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
    maxWidth: "640px",
  });

  const label = document.createElement("label");
  label.textContent = "Prediction Mode";
  Object.assign(label.style, {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "12px",
    color: "var(--nv-toolbar-dropdown-text, #704214)",
    whiteSpace: "nowrap",
    userSelect: "none",
  });

  const select = document.createElement("select");
  select.title = "Choose how Pencil Sketch predicts the active preview";
  Object.assign(select.style, {
    fontSize: "12px",
    minWidth: "180px",
    height: "24px",
  });
  MODE_OPTIONS.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    select.appendChild(item);
  });

  const mirrorX = mirrorCheckbox("Mirror X", "x");
  const mirrorY = mirrorCheckbox("Mirror Y", "y");

  function syncMirrorState() {
    const irregular = isIrregularMode(select.value);
    mirrorX.input.checked = readMirror("x");
    mirrorY.input.checked = readMirror("y");
    mirrorX.label.style.opacity = irregular ? "1" : "0.64";
    mirrorY.label.style.opacity = irregular ? "1" : "0.64";
  }

  select.value = readMode();
  syncMirrorState();
  select.addEventListener("change", () => {
    select.value = writeMode(select.value);
    syncMirrorState();
  });

  label.appendChild(select);
  wrapper.append(
    label,
    mirrorX.label,
    mirrorY.label,
    actionButton("End Curve / New Curve", "Finalize the current curve preview and start a new sketch preview", "endSketchCurveAndStartNew"),
    actionButton("Set Focal Point", "Click in the sketch preview to set or replace the Irregular Shape focal point", "beginSketchFocalPointPlacement"),
    actionButton("Convert Preview to Bezier", "Create an editable Bezier path from the current preview while keeping pencil strokes visible", "convertSketchPreviewToBezier"),
    actionButton("Finalize Bezier", "Commit the current Bezier refinement path as normal SVG geometry", "finalizeSketchBezier"),
  );
  hostElement.appendChild(wrapper);

  const sync = () => {
    if (!select.isConnected) {
      window.removeEventListener("nv-sketch-previews-changed", sync);
      return;
    }
    select.value = readMode();
    syncMirrorState();
  };
  window.addEventListener("nv-sketch-previews-changed", sync);
}

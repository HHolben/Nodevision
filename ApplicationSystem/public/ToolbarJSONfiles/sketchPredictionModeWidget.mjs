// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/sketchPredictionModeWidget.mjs
// Pencil Sketch prediction mode selector and curve refinement actions.

const MODE_OPTIONS = [
  { value: "raw", label: "Raw Pencil" },
  { value: "shape", label: "Shape Sketch" },
  { value: "curve", label: "Curve Sketch" },
  { value: "function-curve", label: "Function Curve" },
  { value: "irregular-shape", label: "Irregular Shape" },
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
  if (mode === "irregular" || mode === "irregular-shape" || mode === "irregular shape" || mode === "blob" || mode === "radial-shape") {
    return "irregular-shape";
  }
  return "shape";
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

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = "";

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
    maxWidth: "460px",
  });

  const label = document.createElement("label");
  label.textContent = "Prediction Mode";
  Object.assign(label.style, {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "12px",
    color: "#222",
    whiteSpace: "nowrap",
    userSelect: "none",
  });

  const select = document.createElement("select");
  select.title = "Choose how Pencil Sketch predicts the active preview";
  Object.assign(select.style, {
    fontSize: "12px",
    minWidth: "122px",
    height: "24px",
  });
  MODE_OPTIONS.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    select.appendChild(item);
  });
  select.value = readMode();
  select.addEventListener("change", () => {
    select.value = writeMode(select.value);
  });

  label.appendChild(select);
  wrapper.append(
    label,
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
  };
  window.addEventListener("nv-sketch-previews-changed", sync);
}

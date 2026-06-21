// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/sketchStrokeOrderWidget.mjs
// Development widget for coloring raw Pencil Sketch strokes by draw order.

function getSketchContext() {
  return window.SVGEditorContext || null;
}

function readEnabled() {
  const ctx = getSketchContext();
  if (typeof ctx?.getSketchStrokeOrderColors === "function") {
    return Boolean(ctx.getSketchStrokeOrderColors());
  }
  return Boolean(window.NodevisionState?.enableSketchStrokeOrderColors);
}

function writeEnabled(enabled) {
  const next = Boolean(enabled);
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.enableSketchStrokeOrderColors = next;
  window.NodevisionSketchSettings = window.NodevisionSketchSettings || {};
  window.NodevisionSketchSettings.enableSketchStrokeOrderColors = next;
  getSketchContext()?.setSketchStrokeOrderColors?.(next);
  return next;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = "";

  const label = document.createElement("label");
  Object.assign(label.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#222",
    whiteSpace: "nowrap",
    userSelect: "none",
  });

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = readEnabled();
  checkbox.title = "Color raw pencil strokes from first red to newest violet";

  const text = document.createElement("span");
  text.textContent = "Color stroke order";

  label.append(checkbox, text);
  hostElement.appendChild(label);

  checkbox.addEventListener("change", () => {
    writeEnabled(checkbox.checked);
  });

  const sync = () => {
    if (!checkbox.isConnected) {
      window.removeEventListener("nv-sketch-previews-changed", sync);
      return;
    }
    checkbox.checked = readEnabled();
  };
  window.addEventListener("nv-sketch-previews-changed", sync);
}

// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/svgStyleWidget.mjs
// This is a sub-toolbar widget for SVG fill/stroke styling.

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function readHexColor(value, fallback) {
  const v = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return fallback;
}

function getSvgContext() {
  return window.SVGEditorContext || null;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = "";

  const container = document.createElement("div");
  Object.assign(container.style, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "12px",
    whiteSpace: "nowrap",
  });

  const makeLabel = (text) => {
    const label = document.createElement("label");
    Object.assign(label.style, { display: "flex", alignItems: "center", gap: "6px" });
    const span = document.createElement("span");
    span.textContent = text;
    Object.assign(span.style, { color: "#222" });
    label.appendChild(span);
    return { label, span };
  };

  const fill = makeLabel("Fill");
  const fillInput = document.createElement("input");
  fillInput.type = "color";
  Object.assign(fillInput.style, { width: "30px", height: "22px", padding: "0", border: "0", background: "transparent" });
  fill.label.appendChild(fillInput);

  const stroke = makeLabel("Stroke");
  const strokeInput = document.createElement("input");
  strokeInput.type = "color";
  Object.assign(strokeInput.style, { width: "30px", height: "22px", padding: "0", border: "0", background: "transparent" });
  stroke.label.appendChild(strokeInput);

  const width = makeLabel("W");
  const widthInput = document.createElement("input");
  widthInput.type = "number";
  widthInput.min = "0";
  widthInput.step = "0.5";
  Object.assign(widthInput.style, { width: "64px", height: "22px" });
  width.label.appendChild(widthInput);

  const applyBtn = document.createElement("button");
  applyBtn.textContent = "Apply";
  Object.assign(applyBtn.style, {
    height: "24px",
    padding: "0 10px",
    cursor: "pointer",
  });

  container.append(fill.label, stroke.label, width.label, applyBtn);
  hostElement.appendChild(container);

  function syncFromContext() {
    const ctx = getSvgContext();
    const defaults = ctx?.getCurrentStyleDefaults?.() || {};
    fillInput.value = readHexColor(defaults.fill, "#80c0ff");
    strokeInput.value = readHexColor(defaults.stroke, "#000000");
    widthInput.value = String(defaults.strokeWidth || "2");
  }

  function setFill(value) {
    const ctx = getSvgContext();
    if (!ctx?.setFillColor) return;
    ctx.setFillColor(value);
  }

  function setStroke(value) {
    const ctx = getSvgContext();
    if (!ctx?.setStrokeColor) return;
    ctx.setStrokeColor(value);
  }

  function setStrokeWidth(value) {
    const ctx = getSvgContext();
    if (!ctx?.setStrokeWidth) return;
    const n = clampNumber(value, { min: 0, max: 9999 });
    if (n === null) return;
    ctx.setStrokeWidth(String(n));
  }

  fillInput.addEventListener("input", () => setFill(fillInput.value));
  strokeInput.addEventListener("input", () => setStroke(strokeInput.value));
  widthInput.addEventListener("change", () => setStrokeWidth(widthInput.value));
  widthInput.addEventListener("input", () => setStrokeWidth(widthInput.value));

  applyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const ctx = getSvgContext();
    if (!ctx?.applyCurrentStyleToSelection) return;
    ctx.applyCurrentStyleToSelection();
  });

  if (!window.__nvSvgStyleWidgetBound) {
    window.addEventListener("nv-svg-editor-selection-changed", () => syncFromContext());
    window.addEventListener("nv-svg-editor-layout-changed", () => syncFromContext());
    window.__nvSvgStyleWidgetBound = true;
  }

  syncFromContext();
}


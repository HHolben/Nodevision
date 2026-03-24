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

function ensureDefs(svgRoot) {
  if (!svgRoot) return null;
  let defs = svgRoot.querySelector(":scope > defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svgRoot.insertBefore(defs, svgRoot.firstChild || null);
  }
  return defs;
}

function makeUniqueDefId(defs, prefix) {
  const existing = new Set(Array.from(defs?.querySelectorAll?.("[id]") || []).map((n) => n.id));
  let id = "";
  do {
    id = `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  } while (existing.has(id));
  return id;
}

function setStops(gradientEl, stops) {
  while (gradientEl.firstChild) gradientEl.removeChild(gradientEl.firstChild);
  stops.forEach(({ offset, color } = {}) => {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", String(offset));
    stop.setAttribute("stop-color", String(color || "#000000"));
    gradientEl.appendChild(stop);
  });
}

function createLinearGradient(svgRoot, { from, to, direction } = {}) {
  const defs = ensureDefs(svgRoot);
  if (!defs) return null;
  const id = makeUniqueDefId(defs, "linear-grad");
  const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  grad.setAttribute("id", id);

  const dirs = {
    horizontal: ["0%", "0%", "100%", "0%"],
    vertical: ["0%", "0%", "0%", "100%"],
    diagDown: ["0%", "0%", "100%", "100%"],
    diagUp: ["0%", "100%", "100%", "0%"],
  };
  const [x1, y1, x2, y2] = dirs[String(direction || "horizontal")] || dirs.horizontal;
  grad.setAttribute("x1", x1);
  grad.setAttribute("y1", y1);
  grad.setAttribute("x2", x2);
  grad.setAttribute("y2", y2);
  setStops(grad, [
    { offset: "0%", color: from || "#000000" },
    { offset: "100%", color: to || "#ffffff" },
  ]);
  defs.appendChild(grad);
  return id;
}

function createRadialGradient(svgRoot, { inner, outer } = {}) {
  const defs = ensureDefs(svgRoot);
  if (!defs) return null;
  const id = makeUniqueDefId(defs, "radial-grad");
  const grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
  grad.setAttribute("id", id);
  grad.setAttribute("cx", "50%");
  grad.setAttribute("cy", "50%");
  grad.setAttribute("r", "50%");
  setStops(grad, [
    { offset: "0%", color: inner || "#ffffff" },
    { offset: "100%", color: outer || "#000000" },
  ]);
  defs.appendChild(grad);
  return id;
}

function createStripePattern(svgRoot, { stripe, background, size, angle } = {}) {
  const defs = ensureDefs(svgRoot);
  if (!defs) return null;
  const id = makeUniqueDefId(defs, "pattern-stripes");
  const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
  pattern.setAttribute("id", id);
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  const s = Math.max(2, Number.parseInt(String(size || 10), 10) || 10);
  pattern.setAttribute("width", String(s));
  pattern.setAttribute("height", String(s));
  const a = Number.isFinite(Number(angle)) ? Number(angle) : 45;
  pattern.setAttribute("patternTransform", `rotate(${a})`);

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", String(s));
  bg.setAttribute("height", String(s));
  bg.setAttribute("fill", String(background || "#ffffff"));
  pattern.appendChild(bg);

  const stripeRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  stripeRect.setAttribute("width", String(Math.max(1, Math.round(s / 2))));
  stripeRect.setAttribute("height", String(s));
  stripeRect.setAttribute("fill", String(stripe || "#000000"));
  pattern.appendChild(stripeRect);

  defs.appendChild(pattern);
  return id;
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
  const fillMode = document.createElement("select");
  Object.assign(fillMode.style, {
    height: "22px",
    fontSize: "12px",
    padding: "0 4px",
    border: "1px solid #c7c7c7",
    borderRadius: "6px",
    background: "#fff",
  });
  [
    { value: "color", label: "Color" },
    { value: "linear", label: "Linear" },
    { value: "radial", label: "Radial" },
    { value: "pattern", label: "Pattern" },
  ].forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    fillMode.appendChild(o);
  });
  fillMode.title = "Fill type";
  fill.label.appendChild(fillMode);

  const fillInput = document.createElement("input");
  fillInput.type = "color";
  Object.assign(fillInput.style, { width: "30px", height: "22px", padding: "0", border: "0", background: "transparent" });
  fillInput.title = "Fill color";
  fill.label.appendChild(fillInput);

  const paintWrap = document.createElement("span");
  Object.assign(paintWrap.style, { display: "none", alignItems: "center", gap: "6px" });

  const paintA = document.createElement("input");
  paintA.type = "color";
  Object.assign(paintA.style, { width: "30px", height: "22px", padding: "0", border: "0", background: "transparent" });
  paintA.title = "Paint color A";

  const paintB = document.createElement("input");
  paintB.type = "color";
  Object.assign(paintB.style, { width: "30px", height: "22px", padding: "0", border: "0", background: "transparent" });
  paintB.title = "Paint color B";

  const paintDir = document.createElement("select");
  Object.assign(paintDir.style, {
    height: "22px",
    fontSize: "12px",
    padding: "0 4px",
    border: "1px solid #c7c7c7",
    borderRadius: "6px",
    background: "#fff",
  });
  [
    { value: "horizontal", label: "→" },
    { value: "vertical", label: "↓" },
    { value: "diagDown", label: "↘" },
    { value: "diagUp", label: "↗" },
  ].forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    paintDir.appendChild(o);
  });
  paintDir.title = "Gradient direction";

  const patternSize = document.createElement("input");
  patternSize.type = "number";
  patternSize.min = "2";
  patternSize.step = "1";
  patternSize.value = "10";
  Object.assign(patternSize.style, { width: "56px", height: "22px" });
  patternSize.title = "Pattern size";

  const patternAngle = document.createElement("input");
  patternAngle.type = "number";
  patternAngle.step = "1";
  patternAngle.value = "45";
  Object.assign(patternAngle.style, { width: "56px", height: "22px" });
  patternAngle.title = "Pattern angle";

  const paintApplyBtn = document.createElement("button");
  paintApplyBtn.textContent = "Set";
  Object.assign(paintApplyBtn.style, { height: "22px", padding: "0 8px", cursor: "pointer" });
  paintApplyBtn.title = "Create gradient/pattern and apply as fill";

  paintWrap.append(paintA, paintB, paintDir, patternSize, patternAngle, paintApplyBtn);
  fill.label.appendChild(paintWrap);

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

  function updateFillUi() {
    const mode = String(fillMode.value || "color");
    const isColor = mode === "color";
    fillInput.style.display = isColor ? "" : "none";
    paintWrap.style.display = isColor ? "none" : "inline-flex";
    paintDir.style.display = mode === "linear" ? "" : "none";
    patternSize.style.display = mode === "pattern" ? "" : "none";
    patternAngle.style.display = mode === "pattern" ? "" : "none";
  }

  function syncFromContext() {
    const ctx = getSvgContext();
    const defaults = ctx?.getCurrentStyleDefaults?.() || {};
    fillInput.value = readHexColor(defaults.fill, "#80c0ff");
    strokeInput.value = readHexColor(defaults.stroke, "#000000");
    widthInput.value = String(defaults.strokeWidth || "2");
    paintA.value = readHexColor(defaults.fill, "#80c0ff");
    paintB.value = "#ffffff";
    updateFillUi();
  }

  function setFill(value) {
    const ctx = getSvgContext();
    if (!ctx?.setFillColor) return;
    ctx.setFillColor(value);
  }

  function setPaintFill() {
    const ctx = getSvgContext();
    if (!ctx?.svgRoot || !ctx?.setFillColor) return;
    const mode = String(fillMode.value || "color");
    if (mode === "color") return;

    const c1 = paintA.value || "#000000";
    const c2 = paintB.value || "#ffffff";
    let id = null;
    if (mode === "linear") {
      id = createLinearGradient(ctx.svgRoot, { from: c1, to: c2, direction: paintDir.value });
    } else if (mode === "radial") {
      id = createRadialGradient(ctx.svgRoot, { inner: c1, outer: c2 });
    } else if (mode === "pattern") {
      id = createStripePattern(ctx.svgRoot, { stripe: c1, background: c2, size: patternSize.value, angle: patternAngle.value });
    }
    if (!id) return;
    ctx.setFillColor(`url(#${id})`);
    ctx.applyCurrentStyleToSelection?.();
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
  fillMode.addEventListener("change", () => updateFillUi());
  paintApplyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    setPaintFill();
  });

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

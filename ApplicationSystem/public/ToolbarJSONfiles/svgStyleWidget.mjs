// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/svgStyleWidget.mjs
// This is a sub-toolbar widget for SVG fill/stroke styling.

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function readHexColor(value, fallback) {
  const parsed = parseCssColor(value, fallback);
  return parsed.hex || fallback;
}

function clampTransparency(value, fallback = 0) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function hexToRgb(value) {
  const text = String(value || "").trim();
  const match = text.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match) return null;
  const raw = match[1].length === 3
    ? match[1].split("").map((part) => part + part).join("")
    : match[1];
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
    a: raw.length === 8 ? Number.parseInt(raw.slice(6, 8), 16) / 255 : 1,
  };
}

function rgbToHex({ r, g, b } = {}, fallback = "#000000") {
  if (![r, g, b].every(Number.isFinite)) return fallback;
  const toHex = (part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function parseAlpha(value, fallback = 1) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const n = text.endsWith("%") ? Number.parseFloat(text) / 100 : Number.parseFloat(text);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function formatAlpha(alpha) {
  const clamped = Math.max(0, Math.min(1, alpha));
  if (clamped === 0 || clamped === 1) return String(clamped);
  return String(Math.round(clamped * 100) / 100);
}

function hslToRgb(h, s, l) {
  const hue = (((Number(h) || 0) % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(1, Number(s) / 100));
  const light = Math.max(0, Math.min(1, Number(l) / 100));
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  const [rp, gp, bp] = hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
    : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c]
    : hue < 300 ? [x, 0, c]
    : [c, 0, x];
  return { r: (rp + m) * 255, g: (gp + m) * 255, b: (bp + m) * 255 };
}

function parseCssColor(value, fallback = "#000000") {
  const text = String(value || "").trim();
  if (!text || /^none$/i.test(text) || /^url\(/i.test(text)) return { hex: fallback, transparency: 0 };
  if (/^transparent$/i.test(text)) return { hex: fallback, transparency: 100 };
  const fromHex = hexToRgb(text);
  if (fromHex) return { hex: rgbToHex(fromHex, fallback), transparency: Math.round((1 - fromHex.a) * 100) };
  const rgbMatch = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+%?))?\s*\)$/i)
    || text.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i);
  if (rgbMatch) {
    const alpha = parseAlpha(rgbMatch[4], 1);
    return {
      hex: rgbToHex({ r: Number.parseFloat(rgbMatch[1]), g: Number.parseFloat(rgbMatch[2]), b: Number.parseFloat(rgbMatch[3]) }, fallback),
      transparency: Math.round((1 - alpha) * 100),
    };
  }
  const hslMatch = text.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+%?))?\s*\)$/i)
    || text.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+%?))?\s*\)$/i);
  if (hslMatch) {
    const alpha = parseAlpha(hslMatch[4], 1);
    return {
      hex: rgbToHex(hslToRgb(hslMatch[1], hslMatch[2], hslMatch[3]), fallback),
      transparency: Math.round((1 - alpha) * 100),
    };
  }
  return { hex: fallback, transparency: 0 };
}

function colorWithTransparency(hex, transparency, fallback = "#000000") {
  const rgb = hexToRgb(hex) || hexToRgb(fallback) || { r: 0, g: 0, b: 0 };
  const alpha = (100 - clampTransparency(transparency)) / 100;
  if (alpha >= 1) return rgbToHex(rgb, fallback);
  return "rgba(" + Math.round(rgb.r) + ", " + Math.round(rgb.g) + ", " + Math.round(rgb.b) + ", " + formatAlpha(alpha) + ")";
}

function createTransparencyControl(title) {
  const wrap = document.createElement("span");
  Object.assign(wrap.style, { display: "inline-flex", alignItems: "center", gap: "4px" });
  wrap.title = title || "Transparency";
  const text = document.createElement("span");
  text.textContent = "Trans";
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.step = "1";
  input.value = "0";
  Object.assign(input.style, { width: "70px" });
  const value = document.createElement("span");
  Object.assign(value.style, { display: "inline-block", width: "34px", textAlign: "right" });
  wrap.append(text, input, value);
  return { wrap, input, value };
}

function setTransparencyControl(control, transparency) {
  if (!control?.input) return;
  const value = Math.round(clampTransparency(transparency));
  control.input.value = String(value);
  if (control.value) control.value.textContent = value + "%";
}

function readTransparencyControl(control) {
  return clampTransparency(control?.input?.value);
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
  const fillTransparency = createTransparencyControl("Fill transparency");
  fill.label.appendChild(fillTransparency.wrap);

  const paintWrap = document.createElement("span");
  Object.assign(paintWrap.style, { display: "none", alignItems: "center", gap: "6px" });

  const paintA = document.createElement("input");
  paintA.type = "color";
  Object.assign(paintA.style, { width: "30px", height: "22px", padding: "0", border: "0", background: "transparent" });
  paintA.title = "Paint color A";
  const paintATransparency = createTransparencyControl("Paint color A transparency");

  const paintB = document.createElement("input");
  paintB.type = "color";
  Object.assign(paintB.style, { width: "30px", height: "22px", padding: "0", border: "0", background: "transparent" });
  paintB.title = "Paint color B";
  const paintBTransparency = createTransparencyControl("Paint color B transparency");

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

  paintWrap.append(paintA, paintATransparency.wrap, paintB, paintBTransparency.wrap, paintDir, patternSize, patternAngle, paintApplyBtn);
  fill.label.appendChild(paintWrap);

  const stroke = makeLabel("Stroke");
  const strokeInput = document.createElement("input");
  strokeInput.type = "color";
  Object.assign(strokeInput.style, { width: "30px", height: "22px", padding: "0", border: "0", background: "transparent" });
  stroke.label.appendChild(strokeInput);
  const strokeTransparency = createTransparencyControl("Stroke transparency");
  stroke.label.appendChild(strokeTransparency.wrap);

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
    fillTransparency.wrap.style.display = isColor ? "inline-flex" : "none";
    paintWrap.style.display = isColor ? "none" : "inline-flex";
    paintDir.style.display = mode === "linear" ? "" : "none";
    patternSize.style.display = mode === "pattern" ? "" : "none";
    patternAngle.style.display = mode === "pattern" ? "" : "none";
  }

  function currentFillValue() {
    return colorWithTransparency(fillInput.value || "#80c0ff", readTransparencyControl(fillTransparency), "#80c0ff");
  }

  function currentStrokeValue() {
    return colorWithTransparency(strokeInput.value || "#000000", readTransparencyControl(strokeTransparency), "#000000");
  }

  function syncFromContext() {
    const ctx = getSvgContext();
    const defaults = ctx?.getCurrentStyleDefaults?.() || {};
    const fillColor = parseCssColor(defaults.fill, "#80c0ff");
    const strokeColor = parseCssColor(defaults.stroke, "#000000");
    fillInput.value = fillColor.hex;
    setTransparencyControl(fillTransparency, fillColor.transparency);
    strokeInput.value = strokeColor.hex;
    setTransparencyControl(strokeTransparency, strokeColor.transparency);
    widthInput.value = String(defaults.strokeWidth || "2");
    paintA.value = fillColor.hex;
    setTransparencyControl(paintATransparency, fillColor.transparency);
    paintB.value = "#ffffff";
    setTransparencyControl(paintBTransparency, 0);
    updateFillUi();
  }

  function setFill(value = currentFillValue()) {
    const ctx = getSvgContext();
    if (!ctx?.setFillColor) return;
    ctx.setFillColor(value);
  }

  function setPaintFill() {
    const ctx = getSvgContext();
    if (!ctx?.svgRoot || !ctx?.setFillColor) return;
    const mode = String(fillMode.value || "color");
    if (mode === "color") return;

    const c1 = colorWithTransparency(paintA.value || "#000000", readTransparencyControl(paintATransparency), "#000000");
    const c2 = colorWithTransparency(paintB.value || "#ffffff", readTransparencyControl(paintBTransparency), "#ffffff");
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

  function setStroke(value = currentStrokeValue()) {
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

  fillInput.addEventListener("input", () => setFill());
  fillTransparency.input.addEventListener("input", () => {
    setTransparencyControl(fillTransparency, fillTransparency.input.value);
    setFill();
  });
  strokeInput.addEventListener("input", () => setStroke());
  strokeTransparency.input.addEventListener("input", () => {
    setTransparencyControl(strokeTransparency, strokeTransparency.input.value);
    setStroke();
  });
  paintATransparency.input.addEventListener("input", () => setTransparencyControl(paintATransparency, paintATransparency.input.value));
  paintBTransparency.input.addEventListener("input", () => setTransparencyControl(paintBTransparency, paintBTransparency.input.value));
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

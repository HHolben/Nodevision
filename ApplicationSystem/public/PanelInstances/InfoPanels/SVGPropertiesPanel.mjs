// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SVGPropertiesPanel.mjs
// This module renders an SVG properties panel for the active SVG editor selection. This module edits style and geometry attributes so users can make precise changes through Nodevision panels. This module listens to editor selection events so the UI stays synchronized with canvas interactions.

function safeNumber(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function getAttr(el, name, fallback = "") {
  if (!el) return fallback;
  const v = el.getAttribute(name);
  return v === null ? fallback : v;
}

function setAttr(el, name, value) {
  if (!el) return;
  const v = String(value ?? "").trim();
  if (!v) {
    el.removeAttribute(name);
    return;
  }
  el.setAttribute(name, v);
}

function isColorHex(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim());
}

function isUrlPaint(value) {
  return /^url\(\s*#[-_a-zA-Z0-9:.]+\s*\)$/i.test(String(value || "").trim());
}

function extractUrlId(value) {
  const v = String(value || "").trim();
  const m = v.match(/^url\(\s*#([-\w:.]+)\s*\)$/i);
  return m ? m[1] : null;
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
  stops.forEach(({ offset, color, opacity } = {}) => {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", String(offset));
    stop.setAttribute("stop-color", String(color || "#000000"));
    if (opacity !== undefined && opacity !== null) stop.setAttribute("stop-opacity", String(opacity));
    gradientEl.appendChild(stop);
  });
}

function createLinearGradient(svgRoot, { from = "#000000", to = "#ffffff", direction = "horizontal" } = {}) {
  const defs = ensureDefs(svgRoot);
  if (!defs) return null;
  const id = makeUniqueDefId(defs, "linear-grad");
  const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  grad.setAttribute("id", id);

  const dir = String(direction || "horizontal");
  const dirs = {
    horizontal: ["0%", "0%", "100%", "0%"],
    vertical: ["0%", "0%", "0%", "100%"],
    diagDown: ["0%", "0%", "100%", "100%"],
    diagUp: ["0%", "100%", "100%", "0%"],
  };
  const [x1, y1, x2, y2] = dirs[dir] || dirs.horizontal;
  grad.setAttribute("x1", x1);
  grad.setAttribute("y1", y1);
  grad.setAttribute("x2", x2);
  grad.setAttribute("y2", y2);
  setStops(grad, [
    { offset: "0%", color: from },
    { offset: "100%", color: to },
  ]);
  defs.appendChild(grad);
  return id;
}

function createRadialGradient(svgRoot, { inner = "#ffffff", outer = "#000000" } = {}) {
  const defs = ensureDefs(svgRoot);
  if (!defs) return null;
  const id = makeUniqueDefId(defs, "radial-grad");
  const grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
  grad.setAttribute("id", id);
  grad.setAttribute("cx", "50%");
  grad.setAttribute("cy", "50%");
  grad.setAttribute("r", "50%");
  setStops(grad, [
    { offset: "0%", color: inner },
    { offset: "100%", color: outer },
  ]);
  defs.appendChild(grad);
  return id;
}

function createStripePattern(svgRoot, { background = "#ffffff", stripe = "#000000", size = 10, angle = 45 } = {}) {
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

function makeRow(labelText, controlEl) {
  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: "8px",
    alignItems: "center",
  });
  const label = document.createElement("div");
  label.textContent = labelText;
  label.style.opacity = "0.85";
  row.appendChild(label);
  row.appendChild(controlEl);
  return row;
}

function makeInput(type, placeholder = "") {
  const input = document.createElement("input");
  input.type = type;
  if (placeholder) input.placeholder = placeholder;
  Object.assign(input.style, {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #c7c7c7",
    borderRadius: "8px",
    background: "#fff",
    boxSizing: "border-box",
  });
  return input;
}

function currentSelection(ctx) {
  const selected = ctx?.getSelectedElements?.() || [];
  const primary = ctx?.getSelectedElement?.() || selected[0] || null;
  return { selected, primary };
}

function computeStyleFromSelection({ ctx, selected, primary }) {
  const defaults = ctx?.getCurrentStyleDefaults?.() || {};
  const source = primary || null;
  const fill = getAttr(source, "fill", defaults.fill || "");
  const stroke = getAttr(source, "stroke", defaults.stroke || "");
  const strokeWidth = getAttr(source, "stroke-width", defaults.strokeWidth || "");
  const opacity = getAttr(source, "opacity", "");
  return { fill, stroke, strokeWidth, opacity, hasSelection: selected.length > 0 };
}

function applyStyleToSelection(ctx, { fill, stroke, strokeWidth, opacity }) {
  if (!ctx) return;
  const selected = ctx.getSelectedElements?.() || [];
  if (!selected.length) return;

  const fillValue = fill === undefined ? undefined : String(fill ?? "").trim();
  const strokeValue = stroke === undefined ? undefined : String(stroke ?? "").trim();
  const widthValue = strokeWidth === undefined ? undefined : String(strokeWidth ?? "").trim();
  const opacityValue = opacity === undefined ? undefined : String(opacity ?? "").trim();

  if (fillValue !== undefined) {
    if (!fillValue) selected.forEach((el) => el?.removeAttribute?.("fill"));
    else ctx.setFillColor?.(fillValue);
  }
  if (strokeValue !== undefined) {
    if (!strokeValue) selected.forEach((el) => el?.removeAttribute?.("stroke"));
    else ctx.setStrokeColor?.(strokeValue);
  }
  if (widthValue !== undefined) {
    if (!widthValue) selected.forEach((el) => el?.removeAttribute?.("stroke-width"));
    else ctx.setStrokeWidth?.(widthValue);
  }

  if (selected.length > 1) {
    ctx.applyCurrentStyleToSelection?.();
  }

  if (opacityValue !== undefined) {
    selected.forEach((el) => {
      if (!el) return;
      if (!opacityValue) el.removeAttribute("opacity");
      else el.setAttribute("opacity", opacityValue);
    });
  }
}

function describeElement(el) {
  if (!el) return "No selection";
  const tag = el.tagName ? el.tagName.toLowerCase() : "element";
  const id = el.getAttribute?.("id") || "";
  return id ? `${tag}#${id}` : tag;
}

function buildGeometryEditor({ ctx, host }) {
  host.innerHTML = "";
  const { primary } = currentSelection(ctx);
  if (!primary) return;

  const tag = primary.tagName.toLowerCase();
  const title = document.createElement("div");
  title.textContent = `Geometry: ${tag}`;
  title.style.fontWeight = "700";
  title.style.marginTop = "8px";
  host.appendChild(title);

  const rows = document.createElement("div");
  Object.assign(rows.style, { display: "grid", gap: "8px", marginTop: "8px" });
  host.appendChild(rows);

  const addNumberField = (label, attr) => {
    const input = makeInput("number");
    input.value = String(safeNumber(getAttr(primary, attr, "0"), 0));
    input.addEventListener("input", () => setAttr(primary, attr, input.value));
    rows.appendChild(makeRow(label, input));
  };

  const addTextField = (label, attr) => {
    const input = makeInput("text");
    input.value = getAttr(primary, attr, "");
    input.addEventListener("change", () => setAttr(primary, attr, input.value));
    rows.appendChild(makeRow(label, input));
  };

  if (tag === "rect" || tag === "image" || tag === "use" || tag === "foreignobject") {
    addNumberField("x", "x");
    addNumberField("y", "y");
    addNumberField("width", "width");
    addNumberField("height", "height");
    if (tag === "rect") {
      addNumberField("rx", "rx");
      addNumberField("ry", "ry");
    }
    return;
  }

  if (tag === "circle") {
    addNumberField("cx", "cx");
    addNumberField("cy", "cy");
    addNumberField("r", "r");
    return;
  }

  if (tag === "ellipse") {
    addNumberField("cx", "cx");
    addNumberField("cy", "cy");
    addNumberField("rx", "rx");
    addNumberField("ry", "ry");
    return;
  }

  if (tag === "line") {
    addNumberField("x1", "x1");
    addNumberField("y1", "y1");
    addNumberField("x2", "x2");
    addNumberField("y2", "y2");
    return;
  }

  if (tag === "path") {
    addTextField("d", "d");
    return;
  }

  if (tag === "polygon" || tag === "polyline") {
    addTextField("points", "points");
    return;
  }

  if (tag === "text") {
    addNumberField("x", "x");
    addNumberField("y", "y");
    const input = makeInput("text", "Text content");
    input.value = primary.textContent || "";
    input.addEventListener("change", () => {
      primary.textContent = input.value;
    });
    rows.appendChild(makeRow("text", input));
    return;
  }
}

export async function setupPanel(panel, instanceVars = {}) {
  if (!panel) throw new Error("Panel container required.");
  panel.innerHTML = "";
  Object.assign(panel.style, {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    gap: "10px",
  });

  const header = document.createElement("div");
  header.textContent = "SVG Properties";
  Object.assign(header.style, {
    fontWeight: "800",
    borderBottom: "1px solid #d0d0d0",
    paddingBottom: "6px",
  });
  panel.appendChild(header);

  const ctx = window.SVGEditorContext;
  if (!ctx) {
    const message = document.createElement("div");
    message.textContent = "Open an SVG file in the graphical editor to edit selection properties.";
    message.style.padding = "12px";
    message.style.color = "#b00020";
    panel.appendChild(message);
    return;
  }

  const summary = document.createElement("div");
  summary.style.fontSize = "12px";
  summary.style.opacity = "0.85";
  panel.appendChild(summary);

  const styleSection = document.createElement("div");
  Object.assign(styleSection.style, { display: "grid", gap: "8px" });
  panel.appendChild(styleSection);

  const fillControl = document.createElement("div");
  Object.assign(fillControl.style, { display: "grid", gap: "6px" });

  const fillModeRow = document.createElement("div");
  Object.assign(fillModeRow.style, { display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" });
  const fillMode = document.createElement("select");
  Object.assign(fillMode.style, {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #c7c7c7",
    borderRadius: "8px",
    background: "#fff",
    boxSizing: "border-box",
  });
  [
    { value: "color", label: "Color" },
    { value: "linear", label: "Linear Gradient" },
    { value: "radial", label: "Radial Gradient" },
    { value: "pattern", label: "Pattern (Stripes)" },
  ].forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    fillMode.appendChild(o);
  });
  fillModeRow.appendChild(fillMode);

  const fillApplyPaintBtn = document.createElement("button");
  fillApplyPaintBtn.type = "button";
  fillApplyPaintBtn.textContent = "Apply";
  fillApplyPaintBtn.title = "Create gradient/pattern and apply to selection";
  fillModeRow.appendChild(fillApplyPaintBtn);
  fillControl.appendChild(fillModeRow);

  const fillRow = document.createElement("div");
  Object.assign(fillRow.style, { display: "grid", gridTemplateColumns: "1fr 92px", gap: "8px" });
  const fillText = makeInput("text", "#RRGGBB, none, or url(#id)");
  const fillColor = makeInput("color");
  fillColor.style.padding = "0";
  fillColor.style.height = "34px";
  fillRow.appendChild(fillText);
  fillRow.appendChild(fillColor);
  fillControl.appendChild(fillRow);

  const paintOptions = document.createElement("div");
  Object.assign(paintOptions.style, {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
    alignItems: "center",
  });
  const paintA = makeInput("color");
  paintA.value = "#80c0ff";
  paintA.style.padding = "0";
  paintA.style.height = "34px";
  const paintB = makeInput("color");
  paintB.value = "#ffffff";
  paintB.style.padding = "0";
  paintB.style.height = "34px";
  const paintDir = document.createElement("select");
  Object.assign(paintDir.style, {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #c7c7c7",
    borderRadius: "8px",
    background: "#fff",
    boxSizing: "border-box",
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
  paintOptions.appendChild(paintA);
  paintOptions.appendChild(paintB);
  paintOptions.appendChild(paintDir);
  fillControl.appendChild(paintOptions);

  const patternOptions = document.createElement("div");
  Object.assign(patternOptions.style, {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    alignItems: "center",
  });
  const patternSize = makeInput("number");
  patternSize.min = "2";
  patternSize.step = "1";
  patternSize.value = "10";
  patternSize.title = "Pattern size";
  const patternAngle = makeInput("number");
  patternAngle.step = "1";
  patternAngle.value = "45";
  patternAngle.title = "Pattern angle";
  patternOptions.appendChild(patternSize);
  patternOptions.appendChild(patternAngle);
  fillControl.appendChild(patternOptions);

  styleSection.appendChild(makeRow("Fill", fillControl));

  const strokeRow = document.createElement("div");
  Object.assign(strokeRow.style, { display: "grid", gridTemplateColumns: "1fr 92px", gap: "8px" });
  const strokeText = makeInput("text", "#RRGGBB or none");
  const strokeColor = makeInput("color");
  strokeColor.style.padding = "0";
  strokeColor.style.height = "34px";
  strokeRow.appendChild(strokeText);
  strokeRow.appendChild(strokeColor);
  styleSection.appendChild(makeRow("Stroke", strokeRow));

  const strokeWidth = makeInput("number");
  styleSection.appendChild(makeRow("Stroke Width", strokeWidth));

  const opacity = makeInput("number");
  opacity.step = "0.05";
  opacity.min = "0";
  opacity.max = "1";
  styleSection.appendChild(makeRow("Opacity", opacity));

  const geometryHost = document.createElement("div");
  Object.assign(geometryHost.style, {
    flex: "1",
    minHeight: "0",
    overflow: "auto",
    paddingTop: "6px",
  });
  panel.appendChild(geometryHost);

  const syncFromSelection = () => {
    const { selected, primary } = currentSelection(ctx);
    summary.textContent = selected.length
      ? `Selected: ${selected.length} (${describeElement(primary)})`
      : "Selected: 0";

    const style = computeStyleFromSelection({ ctx, selected, primary });
    fillText.value = style.fill || "";
    strokeText.value = style.stroke || "";
    strokeWidth.value = style.strokeWidth || "";
    opacity.value = style.opacity || "";

    if (isColorHex(style.fill)) fillColor.value = style.fill;
    if (isColorHex(style.stroke)) strokeColor.value = style.stroke;

    // Best-effort: infer fill mode from current fill paint.
    if (!style.fill || style.fill === "none" || isColorHex(style.fill)) {
      fillMode.value = "color";
    } else if (isUrlPaint(style.fill) && ctx.svgRoot) {
      const id = extractUrlId(style.fill);
      const paintEl = id ? ctx.svgRoot.querySelector(`#${CSS.escape(id)}`) : null;
      const tag = paintEl?.tagName?.toLowerCase?.() || "";
      if (tag === "lineargradient") fillMode.value = "linear";
      else if (tag === "radialgradient") fillMode.value = "radial";
      else if (tag === "pattern") fillMode.value = "pattern";
    }

    // Seed paint option pickers from defaults (or existing paint where easy).
    const defaults = ctx.getCurrentStyleDefaults?.() || {};
    paintA.value = isColorHex(defaults.fill) ? defaults.fill : paintA.value;

    if (isUrlPaint(style.fill) && ctx.svgRoot) {
      const id = extractUrlId(style.fill);
      const paintEl = id ? ctx.svgRoot.querySelector(`#${CSS.escape(id)}`) : null;
      const tag = paintEl?.tagName?.toLowerCase?.() || "";
      if (tag === "lineargradient" || tag === "radialgradient") {
        const stops = Array.from(paintEl.querySelectorAll("stop"));
        const c0 = stops[0]?.getAttribute?.("stop-color");
        const c1 = stops[stops.length - 1]?.getAttribute?.("stop-color");
        if (isColorHex(c0)) paintA.value = c0;
        if (isColorHex(c1)) paintB.value = c1;
      }
    }

    buildGeometryEditor({ ctx, host: geometryHost });
    updateFillUiForMode();
  };

  const updateFillUiForMode = () => {
    const mode = String(fillMode.value || "color");
    const isColor = mode === "color";
    paintOptions.style.display = isColor ? "none" : "grid";
    paintDir.style.display = mode === "linear" ? "" : "none";
    patternOptions.style.display = mode === "pattern" ? "grid" : "none";
    fillColor.disabled = !isColor;
    fillApplyPaintBtn.disabled = isColor;
    fillApplyPaintBtn.style.opacity = fillApplyPaintBtn.disabled ? "0.5" : "1";
  };

  const applyFromInputs = () => {
    const fill = fillText.value.trim();
    const stroke = strokeText.value.trim();
    const width = strokeWidth.value.trim();
    const op = opacity.value.trim();
    applyStyleToSelection(ctx, { fill, stroke, strokeWidth: width, opacity: op });
  };

  fillText.addEventListener("change", applyFromInputs);
  strokeText.addEventListener("change", applyFromInputs);
  strokeWidth.addEventListener("change", applyFromInputs);
  opacity.addEventListener("change", applyFromInputs);

  fillColor.addEventListener("input", () => {
    if (fillMode.value === "color") {
      fillText.value = fillColor.value;
      applyFromInputs();
    }
  });
  strokeColor.addEventListener("input", () => {
    strokeText.value = strokeColor.value;
    applyFromInputs();
  });

  fillMode.addEventListener("change", () => updateFillUiForMode());

  fillApplyPaintBtn.addEventListener("click", () => {
    const mode = String(fillMode.value || "color");
    if (mode === "color") return;
    if (!ctx?.svgRoot) return;

    const c1 = paintA.value || "#000000";
    const c2 = paintB.value || "#ffffff";
    let id = null;

    if (mode === "linear") {
      id = createLinearGradient(ctx.svgRoot, { from: c1, to: c2, direction: paintDir.value });
    } else if (mode === "radial") {
      id = createRadialGradient(ctx.svgRoot, { inner: c1, outer: c2 });
    } else if (mode === "pattern") {
      id = createStripePattern(ctx.svgRoot, {
        background: c2,
        stripe: c1,
        size: patternSize.value,
        angle: patternAngle.value,
      });
    }

    if (!id) return;
    fillText.value = `url(#${id})`;
    applyFromInputs();
  });

  const onSelection = () => syncFromSelection();
  const abort = new AbortController();
  window.addEventListener("nv-svg-editor-selection-changed", onSelection, { signal: abort.signal });
  const disconnectObserver = new MutationObserver(() => {
    if (panel.isConnected) return;
    abort.abort();
    disconnectObserver.disconnect();
  });
  disconnectObserver.observe(document.body, { childList: true, subtree: true });

  syncFromSelection();
}

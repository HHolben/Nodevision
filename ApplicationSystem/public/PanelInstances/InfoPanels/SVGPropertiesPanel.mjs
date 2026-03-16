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

  const fillRow = document.createElement("div");
  Object.assign(fillRow.style, { display: "grid", gridTemplateColumns: "1fr 92px", gap: "8px" });
  const fillText = makeInput("text", "#RRGGBB or none");
  const fillColor = makeInput("color");
  fillColor.style.padding = "0";
  fillColor.style.height = "34px";
  fillRow.appendChild(fillText);
  fillRow.appendChild(fillColor);
  styleSection.appendChild(makeRow("Fill", fillRow));

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

    buildGeometryEditor({ ctx, host: geometryHost });
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
    fillText.value = fillColor.value;
    applyFromInputs();
  });
  strokeColor.addEventListener("input", () => {
    strokeText.value = strokeColor.value;
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

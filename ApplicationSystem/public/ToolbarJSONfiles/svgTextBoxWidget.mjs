// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/svgTextBoxWidget.mjs
// Renders the SVG Editing sub-toolbar widget for inserting a styled text box.

const SVG_MODE = "SVG Editing";
const SVG_NS = "http://www.w3.org/2000/svg";

function ensureSvgContext() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.svgRoot) {
    console.error("SVGEditorContext not found. Are you in SVG Editing mode?");
    return null;
  }
  return ctx;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  children.forEach((c) => node.appendChild(c));
  return node;
}

function labeled(label, control) {
  const wrap = document.createElement("label");
  wrap.textContent = label;
  Object.assign(wrap.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    whiteSpace: "nowrap",
  });
  wrap.appendChild(control);
  return wrap;
}

function styleInputBase(input) {
  Object.assign(input.style, {
    height: "26px",
    fontSize: "12px",
    padding: "0 6px",
    border: "1px solid #888",
    borderRadius: "4px",
  });
}

function makeToggleButton(label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.dataset.on = "false";
  Object.assign(btn.style, {
    height: "26px",
    padding: "0 8px",
    border: "1px solid #333",
    borderRadius: "4px",
    background: "#eee",
    cursor: "pointer",
    fontSize: "12px",
    lineHeight: "26px",
  });
  const sync = () => {
    const on = btn.dataset.on === "true";
    btn.style.background = on ? "#0078d4" : "#eee";
    btn.style.color = on ? "#fff" : "#000";
    btn.style.borderColor = on ? "#106ebe" : "#333";
  };
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.dataset.on = btn.dataset.on === "true" ? "false" : "true";
    sync();
  });
  sync();
  return btn;
}

function insertTextBox(ctx, options) {
  const {
    text,
    fontFamily,
    fontSize,
    textColor,
    backgroundColor,
    backgroundEnabled,
    bold,
    italic,
    underline,
  } = options;

  const svgRoot = ctx.svgRoot;
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("data-nv-textbox", "true");

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", "40");
  rect.setAttribute("y", "40");
  rect.setAttribute("rx", "4");
  rect.setAttribute("ry", "4");
  rect.setAttribute("fill", backgroundEnabled ? backgroundColor : "none");
  rect.setAttribute("stroke", "rgba(0,0,0,0.35)");
  rect.setAttribute("stroke-width", "1");

  const textEl = document.createElementNS(SVG_NS, "text");
  textEl.setAttribute("x", "52");
  textEl.setAttribute("y", String(52 + fontSize));
  textEl.setAttribute("font-family", fontFamily);
  textEl.setAttribute("font-size", String(fontSize));
  textEl.setAttribute("fill", textColor);
  textEl.setAttribute("font-weight", bold ? "bold" : "normal");
  textEl.setAttribute("font-style", italic ? "italic" : "normal");
  if (underline) textEl.setAttribute("text-decoration", "underline");
  textEl.textContent = text;

  group.append(rect, textEl);

  if (ctx.layers?.appendToActiveLayer) {
    ctx.layers.appendToActiveLayer(group);
  } else {
    svgRoot.appendChild(group);
  }

  // Size background rect to text bounds (best effort).
  try {
    const bb = textEl.getBBox();
    const padX = 12;
    const padY = 10;
    rect.setAttribute("x", String(bb.x - padX));
    rect.setAttribute("y", String(bb.y - padY));
    rect.setAttribute("width", String(bb.width + padX * 2));
    rect.setAttribute("height", String(bb.height + padY * 2));
  } catch {
    rect.setAttribute("width", "220");
    rect.setAttribute("height", String(Math.max(44, fontSize + 22)));
  }

  window.selectSVGElement?.(group);
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  if ((window.NodevisionState?.currentMode || "") !== SVG_MODE) return;

  const mount =
    hostElement.querySelector("#nv-svg-insert-textbox-widget") || hostElement;
  mount.innerHTML = "";

  const ctx = ensureSvgContext();
  if (!ctx) return;

  const textInput = el("input", {
    type: "text",
    value: "Text",
    placeholder: "Text",
  });
  styleInputBase(textInput);
  textInput.style.width = "140px";

  const fontSelect = el("select");
  styleInputBase(fontSelect);
  [
    "Arial",
    "Helvetica",
    "Times New Roman",
    "Georgia",
    "Courier New",
    "Verdana",
  ].forEach((name) => {
    fontSelect.appendChild(el("option", { value: name, textContent: name }));
  });

  const fontSizeInput = el("input", { type: "number", value: "16", min: "6", max: "200" });
  styleInputBase(fontSizeInput);
  fontSizeInput.style.width = "70px";

  const textColorInput = el("input", { type: "color", value: "#000000" });
  Object.assign(textColorInput.style, { height: "26px", width: "34px", padding: "0", border: "1px solid #888", borderRadius: "4px" });

  const bgEnabledInput = el("input", { type: "checkbox", checked: false });
  const bgColorInput = el("input", { type: "color", value: "#ffffff", disabled: true });
  Object.assign(bgColorInput.style, { height: "26px", width: "34px", padding: "0", border: "1px solid #888", borderRadius: "4px" });
  bgEnabledInput.addEventListener("change", () => {
    bgColorInput.disabled = !bgEnabledInput.checked;
    bgColorInput.style.opacity = bgEnabledInput.checked ? "1" : "0.55";
  });
  bgColorInput.style.opacity = "0.55";

  const boldBtn = makeToggleButton("B");
  const italicBtn = makeToggleButton("I");
  const underlineBtn = makeToggleButton("U");

  const insertBtn = el("button", { type: "button", textContent: "Insert" });
  Object.assign(insertBtn.style, {
    height: "28px",
    padding: "0 10px",
    border: "1px solid #333",
    borderRadius: "4px",
    background: "#eee",
    cursor: "pointer",
    fontSize: "12px",
    lineHeight: "28px",
    whiteSpace: "nowrap",
  });

  insertBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const text = String(textInput.value || "").trim();
    if (!text) return;
    const fontFamily = String(fontSelect.value || "Arial");
    const fontSize = Math.max(6, Number(fontSizeInput.value || 16) || 16);
    const textColor = String(textColorInput.value || "#000000");
    const backgroundColor = String(bgColorInput.value || "#ffffff");
    const backgroundEnabled = Boolean(bgEnabledInput.checked);
    const bold = boldBtn.dataset.on === "true";
    const italic = italicBtn.dataset.on === "true";
    const underline = underlineBtn.dataset.on === "true";

    insertTextBox(ctx, {
      text,
      fontFamily,
      fontSize,
      textColor,
      backgroundColor,
      backgroundEnabled,
      bold,
      italic,
      underline,
    });
  });

  mount.append(
    labeled("Text", textInput),
    labeled("Font", fontSelect),
    labeled("Size", fontSizeInput),
    labeled("Color", textColorInput),
    labeled("Bg", bgEnabledInput),
    bgColorInput,
    boldBtn,
    italicBtn,
    underlineBtn,
    insertBtn
  );
}

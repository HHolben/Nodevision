// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/htmlImageTextToolbar.mjs
// Compact toolbar widget for editing selected HTML image-backed text layout.

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "style") node.style.cssText = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  });
  children.forEach((child) => node.appendChild(child));
  return node;
}

function field(label, input) {
  const labelEl = el("label", {
    style: "display:flex;align-items:center;gap:4px;font:12px monospace;",
    title: label,
  });
  labelEl.append(label, input);
  return labelEl;
}

function makeInput(value = "", placeholder = "") {
  const input = el("input", {
    type: "text",
    value: value || "",
    placeholder,
    style: "width:72px;height:24px;box-sizing:border-box;font:12px monospace;",
  });
  return input;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = "";
  const tools = window.HTMLWysiwygTools;
  const layout = tools?.readSelectedTextImageLayout?.();
  if (!tools || !layout) return;

  const widthInput = makeInput(layout.width, "auto");
  const heightInput = makeInput(layout.height, "auto");
  const marginInput = makeInput(layout.margin, "0");
  const alignSelect = el("select", { style: "height:24px;font:12px monospace;" });
  ["baseline", "middle", "text-top", "text-bottom", "top", "bottom"].forEach((value) => {
    const option = el("option", { value, text: value });
    if ((layout.verticalAlign || "baseline") === value) option.selected = true;
    alignSelect.appendChild(option);
  });

  const displaySelect = el("select", { style: "height:24px;font:12px monospace;" });
  ["inline-block", "inline", "block"].forEach((value) => {
    const option = el("option", { value, text: value });
    if ((layout.display || "inline-block") === value) option.selected = true;
    displaySelect.appendChild(option);
  });

  const fitSelect = el("select", { style: "height:24px;font:12px monospace;" });
  [
    ["contain", "contain"],
    ["cover", "cover"],
    ["100% 100%", "stretch"],
    ["auto", "auto"],
  ].forEach(([value, label]) => {
    const option = el("option", { value, text: label });
    if ((layout.backgroundSize || "contain") === value) option.selected = true;
    fitSelect.appendChild(option);
  });

  const applyBtn = el("button", { type: "button", text: "Apply", style: "height:24px;font:12px monospace;" });
  const resetBtn = el("button", { type: "button", text: "Reset", style: "height:24px;font:12px monospace;" });

  const apply = (layoutPatch) => {
    tools.applySelectedTextImageLayout?.(layoutPatch);
  };

  applyBtn.addEventListener("click", () => apply({
    width: widthInput.value,
    height: heightInput.value,
    margin: marginInput.value,
    verticalAlign: alignSelect.value,
    display: displaySelect.value,
    backgroundSize: fitSelect.value,
  }));

  resetBtn.addEventListener("click", () => {
    widthInput.value = "";
    heightInput.value = "";
    marginInput.value = "";
    alignSelect.value = "baseline";
    displaySelect.value = "inline-block";
    fitSelect.value = "contain";
    apply({
      width: "",
      height: "",
      margin: "",
      verticalAlign: "baseline",
      display: "inline-block",
      backgroundSize: "contain",
      minWidth: "1em",
      minHeight: "1em",
    });
  });

  hostElement.style.display = "flex";
  hostElement.style.alignItems = "center";
  hostElement.style.gap = "8px";
  hostElement.style.flexWrap = "wrap";
  hostElement.append(
    field("W", widthInput),
    field("H", heightInput),
    field("M", marginInput),
    field("Align", alignSelect),
    field("Display", displaySelect),
    field("Fit", fitSelect),
    applyBtn,
    resetBtn,
  );
}

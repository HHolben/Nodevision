// Nodevision/ApplicationSystem/public/Controls/HexColorControl.mjs
// This module builds a reusable hex color picker with a swatch, exact text value, and reset button.

export function normalizeHexControlColor(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const candidate = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-f]{3}$/i.test(candidate)) {
    return "#" + candidate.split("").map((ch) => ch + ch).join("").toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(candidate)) return "#" + candidate.toUpperCase();
  return "";
}

function makeInput(type, attrs = {}) {
  const input = document.createElement("input");
  input.type = type;
  Object.assign(input, attrs);
  return input;
}

export function createHexColorControl({
  label = "Color",
  value = "",
  fallback = "#000000",
  resetLabel = "Reset",
  onCommit = () => {},
} = {}) {
  const root = document.createElement("span");
  root.className = "nv-hex-color-control";

  const labelEl = document.createElement("label");
  labelEl.textContent = label + " ";

  const colorInput = makeInput("color");
  const textInput = makeInput("text", { maxLength: 7, placeholder: fallback });
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = resetLabel;

  labelEl.append(colorInput, textInput);
  root.append(labelEl, resetButton);

  function setValue(nextValue = "") {
    const normalized = normalizeHexControlColor(nextValue);
    const fallbackColor = normalizeHexControlColor(fallback) || "#000000";
    colorInput.value = normalized || fallbackColor;
    textInput.value = normalized;
  }

  function setEnabled(enabled) {
    colorInput.disabled = !enabled;
    textInput.disabled = !enabled;
    resetButton.disabled = !enabled;
  }

  colorInput.addEventListener("change", () => {
    textInput.value = colorInput.value;
    onCommit(colorInput.value);
  });
  textInput.addEventListener("change", () => onCommit(textInput.value));
  textInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onCommit(textInput.value);
  });
  resetButton.addEventListener("click", () => onCommit(""));

  setValue(value);
  return { element: root, setValue, setEnabled, colorInput, textInput, resetButton };
}

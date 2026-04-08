// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/SymbolPalette.mjs
// This file defines a horizontal symbol picker for the circuit editor. This file targets the shared sub-toolbar area or a floating fallback strip.

import { SYMBOL_LIBRARY } from "./SymbolLibrary.mjs";

const BTN = [
  "padding:6px 8px",
  "border-radius:8px",
  "border:1px solid transparent",
  "background:#fff",
  "margin:2px",
  "cursor:pointer",
  "font:12px/1.4 Inter, sans-serif",
].join(";");

export function renderSymbolPalette(host, state, onPick, allowedIds = null) {
  host.innerHTML = "";
  host.style.display = "flex";
  host.style.flexWrap = "wrap";
  host.style.alignItems = "center";
  host.style.gap = "4px";

  const buttons = new Map();
  const library = allowedIds
    ? SYMBOL_LIBRARY.filter((s) => allowedIds.includes(s.id))
    : SYMBOL_LIBRARY;
  library.forEach((sym) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = sym.label;
    btn.style.cssText = BTN;
    btn.addEventListener("click", () => onPick(sym.id));
    host.appendChild(btn);
    buttons.set(sym.id, btn);
  });

  function update() {
    buttons.forEach((btn, id) => {
      const active = state.activeSymbol === id;
      btn.style.borderColor = active ? "#38bdf8" : "transparent";
      btn.style.background = active ? "#e0f2fe" : "#fff";
    });
  }

  update();
  return { update };
}

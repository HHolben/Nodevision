// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/PropertiesInspector.mjs
// This file defines the right-side properties inspector for the circuit editor. This file renders context-aware forms for sheets, components, and wires.

import { getSymbol } from "./SymbolLibrary.mjs";

function labeledInput(label, value, onChange) {
  const wrap = document.createElement("div");
  wrap.style.marginBottom = "10px";
  const lab = document.createElement("div");
  lab.textContent = label;
  lab.style.cssText = "font-size:12px;color:#334155;margin-bottom:4px;";
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.style.cssText = "width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:6px;";
  input.addEventListener("input", () => onChange(input.value));
  wrap.append(lab, input);
  return wrap;
}

export function createPropertiesInspector(host, state, handlers) {
  function render() {
    host.innerHTML = "";
    if (!state.selection.length) {
      const title = document.createElement("div");
      title.textContent = "Sheet";
      title.style.cssText = "font-weight:600;margin-bottom:6px;";
      host.appendChild(title);
      host.appendChild(labeledInput("Grid size", state.document.sheet.gridSize, (val) => {
        const num = Number(val) || 20;
        state.document.sheet.gridSize = num;
        handlers.onGridChange?.(num);
      }));
      return;
    }

    if (state.selection.length > 1) {
      const msg = document.createElement("div");
      msg.textContent = `${state.selection.length} objects selected.`;
      msg.style.cssText = "color:#334155;";
      host.appendChild(msg);
      return;
    }

    const id = state.selection[0];
    const cmp = state.document.components.find((c) => c.id === id);
    const wire = state.document.wires.find((w) => w.id === id);

    if (cmp) {
      const title = document.createElement("div");
      title.textContent = getSymbol(cmp.type)?.label || cmp.type;
      title.style.cssText = "font-weight:600;margin-bottom:6px;";
      host.appendChild(title);
      host.appendChild(labeledInput("Reference", cmp.properties.ref, (v) => {
        cmp.properties.ref = v;
        handlers.onChange?.("Updated reference");
      }));
      host.appendChild(labeledInput("Value", cmp.properties.value, (v) => {
        cmp.properties.value = v;
        handlers.onChange?.("Updated value");
      }));
      host.appendChild(labeledInput("Rotation", cmp.rotation, (v) => {
        const angle = Number(v) || 0;
        cmp.rotation = ((angle % 360) + 360) % 360;
        handlers.onChange?.("Rotated component");
      }));
      return;
    }

    if (wire) {
      const title = document.createElement("div");
      title.textContent = "Wire";
      title.style.cssText = "font-weight:600;margin-bottom:6px;";
      host.appendChild(title);
      host.appendChild(labeledInput("Net label", wire.net || "", (v) => {
        wire.net = v;
        handlers.onChange?.("Renamed net");
      }));
    }
  }

  render();
  return { render };
}

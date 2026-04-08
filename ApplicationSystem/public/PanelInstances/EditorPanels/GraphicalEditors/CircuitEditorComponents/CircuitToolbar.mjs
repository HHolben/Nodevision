// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitToolbar.mjs
// This file defines the circuit editor toolbar. This file wires button clicks to tool selection and document actions.

const BUTTON_STYLE = [
  "border:1px solid #cbd5e1",
  "background:#fff",
  "padding:6px 10px",
  "border-radius:6px",
  "cursor:pointer",
  "font:12px/1.2 Inter, sans-serif",
  "color:#0f172a",
  "display:flex",
  "align-items:center",
  "gap:6px",
].join(";");

export function renderCircuitToolbar(host, state, handlers) {
  host.innerHTML = "";
  const buttons = [
    { key: "select", label: "Select", action: () => handlers.setTool("select") },
    { key: "wire", label: "Wire", action: () => handlers.setTool("wire") },
    { key: "text", label: "Text", action: () => handlers.setTool("text") },
    { key: "label", label: "Net Label", action: () => handlers.setTool("label") },
    { key: "rotate", label: "Rotate", action: handlers.rotate },
    { key: "delete", label: "Delete", action: handlers.deleteSelection },
    { key: "save", label: "Save", action: handlers.save },
  ];

  const elements = new Map();
  buttons.forEach((btn) => {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = btn.label;
    el.style.cssText = BUTTON_STYLE;
    el.addEventListener("click", btn.action);
    host.appendChild(el);
    elements.set(btn.key, el);
  });

  function update() {
    elements.forEach((el, key) => {
      const active = state.tool === key;
      el.style.background = active ? "#e0f2fe" : "#fff";
      el.style.borderColor = active ? "#38bdf8" : "#cbd5e1";
    });
  }

  update();
  return { update };
}

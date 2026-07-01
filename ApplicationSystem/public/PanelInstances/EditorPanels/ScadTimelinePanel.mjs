// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/ScadTimelinePanel.mjs
// Timeline panel component for the graphical SCAD editor.

export function renderScadTimelinePanel(container, state, actions = {}) {
  if (!container) return;
  const { model, selectedIds = [] } = state;
  container.innerHTML = "";
  Object.assign(container.style, {
    display: "flex",
    flexDirection: "column",
    minHeight: "132px",
    maxHeight: "210px",
    overflow: "auto",
    borderTop: "1px solid #d6dce5",
    background: "#f7f8fb",
  });

  const header = document.createElement("div");
  header.textContent = "Timeline";
  Object.assign(header.style, { font: "600 12px/1.3 system-ui, sans-serif", padding: "8px 10px", color: "#1f2937" });
  container.appendChild(header);

  const list = document.createElement("div");
  Object.assign(list.style, { display: "flex", gap: "6px", overflowX: "auto", padding: "0 10px 10px" });
  container.appendChild(list);

  const steps = model.timeline || [];
  if (!steps.length) {
    const empty = document.createElement("div");
    empty.textContent = "No modeling steps yet.";
    Object.assign(empty.style, { color: "#6b7280", font: "12px/1.4 system-ui, sans-serif", padding: "8px" });
    list.appendChild(empty);
    return;
  }

  steps.forEach((step, index) => {
    const card = document.createElement("button");
    card.type = "button";
    const active = (step.objectIds || []).some((id) => selectedIds.includes(id));
    Object.assign(card.style, {
      minWidth: "156px",
      maxWidth: "220px",
      textAlign: "left",
      border: active ? "1px solid #f59e0b" : "1px solid #d1d5db",
      borderRadius: "6px",
      background: step.disabled ? "#eef0f4" : "#fff",
      color: step.disabled ? "#7b8190" : "#111827",
      padding: "8px",
      cursor: "pointer",
      opacity: step.disabled ? "0.72" : "1",
    });
    card.innerHTML = `
      <div style="font:600 11px/1.3 system-ui,sans-serif;">${index + 1}. ${escapeHtml(step.label || step.type)}</div>
      <div style="font:11px/1.3 system-ui,sans-serif;color:#6b7280;margin-top:3px;">${escapeHtml(step.type || "step")}</div>
      <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;"></div>
    `;
    card.addEventListener("click", () => actions.selectStep?.(step));
    const controls = card.lastElementChild;
    controls.appendChild(smallButton(step.disabled ? "Enable" : "Disable", (event) => {
      event.stopPropagation();
      actions.toggleStep?.(step.id, !step.disabled);
    }));
    controls.appendChild(smallButton("Rename", (event) => {
      event.stopPropagation();
      const next = prompt("Timeline step name", step.label || step.type);
      if (next !== null) actions.renameStep?.(step.id, next);
    }));
    controls.appendChild(smallButton("Delete", (event) => {
      event.stopPropagation();
      actions.deleteStep?.(step.id);
    }));
    list.appendChild(card);
  });
}

function smallButton(label, handler) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  Object.assign(btn.style, { font: "10px/1 system-ui,sans-serif", padding: "4px 5px", border: "1px solid #d1d5db", borderRadius: "4px", background: "#f9fafb", cursor: "pointer" });
  btn.addEventListener("click", handler);
  return btn;
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

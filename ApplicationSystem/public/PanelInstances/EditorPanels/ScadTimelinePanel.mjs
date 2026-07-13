// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/ScadTimelinePanel.mjs
// CADtimeline panel component for the graphical SCAD editor.

export function renderScadTimelinePanel(container, state, actions = {}) {
  if (!container) return;
  const { model, selectedIds = [] } = state;
  container.innerHTML = "";
  Object.assign(container.style, {
    display: "flex",
    flexDirection: "column",
    minHeight: "0",
    height: "100%",
    overflow: "auto",
    borderTop: "1px solid #d6dce5",
    background: "#f7f8fb",
  });

  const header = document.createElement("div");
  header.textContent = "CADtimeline";
  Object.assign(header.style, { font: "600 12px/1.3 system-ui, sans-serif", padding: "8px 10px", color: "#1f2937" });
  container.appendChild(header);

  const list = document.createElement("div");
  Object.assign(list.style, { display: "flex", flexDirection: "column", gap: "6px", overflow: "visible", padding: "0 10px 10px" });
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
    const codeLine = timelineCodeLine(model, step);
    const operationLabel = (step.params && step.params.operation) || step.type || "step";
    Object.assign(card.style, {
      width: "100%",
      boxSizing: "border-box",
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
      <div style="font:11px/1.3 system-ui,sans-serif;color:#6b7280;margin-top:3px;">${escapeHtml(operationLabel)}</div>
      <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;"></div>
    `;
    if (codeLine) {
      const code = document.createElement("div");
      code.textContent = codeLine;
      Object.assign(code.style, { font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", color: "#374151", marginTop: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
      card.insertBefore(code, card.lastElementChild);
    }
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

function firstStepObject(model, step) {
  const ids = Array.isArray(step?.objectIds) ? step.objectIds : [];
  return (model?.objects || []).find((obj) => ids.includes(obj.id)) || null;
}

function fmtNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(fallback);
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(4)));
}

function vec(values = [], size = 3, fallback = 0) {
  const arr = Array.isArray(values) ? values : [];
  return "[" + Array.from({ length: size }, (_, index) => fmtNumber(arr[index], fallback)).join(", ") + "]";
}

function objectCode(obj) {
  if (!obj) return "// object no longer exists";
  const p = obj.params || {};
  if (obj.type === "circle") return "circle(r = " + fmtNumber(p.radius, 5) + ");";
  if (obj.type === "rectangle") return "square([" + fmtNumber(p.width, 20) + ", " + fmtNumber(p.height, 10) + "], center = " + (p.center ? "true" : "false") + ");";
  if (obj.type === "square") return "square(" + fmtNumber(p.size, 12) + ", center = " + (p.center ? "true" : "false") + ");";
  if (obj.type === "line") return "hull() { /* line */ }";
  if (obj.type === "polygon" || obj.type === "triangle" || obj.type === "vertexPath") return "polygon(points = ...);";
  if (obj.type === "text") return "text(text = " + JSON.stringify(String(p.text || "Text")) + ");";
  if (obj.type === "sphere") return "sphere(r = " + fmtNumber(p.radius, 6) + ");";
  if (obj.type === "cube") {
    const size = Array.isArray(p.size) ? p.size : [p.size || 12, p.size || 12, p.size || 12];
    return "cube(" + vec(size, 3, 12) + ", center = " + (p.center === false ? "false" : "true") + ");";
  }
  if (obj.type === "cylinder") return "cylinder(h = " + fmtNumber(p.height, 16) + ", r = " + fmtNumber(p.radius, 5) + ");";
  if (obj.type === "polyhedron") return "polyhedron(points = ..., faces = ...);";
  return String(obj.type || "object") + "(...);";
}

function timelineCodeLine(model, step) {
  const params = step?.params || {};
  const operation = params.operation || step?.type || "step";
  const obj = firstStepObject(model, step);
  if (operation === "place" || step?.type === "place" || step?.type === "create") return objectCode(obj);
  if (operation === "translate") return "translate(" + vec(params.delta || [0, 0, 0], 3, 0) + ")";
  if (operation === "rotate") return "rotate(" + vec(params.delta || [0, 0, 0], 3, 0) + ")";
  if (operation === "scale") return "scale(" + vec(params.factors || [1, 1, 1], 3, 1) + ")";
  if (operation === "extrude") return "linear_extrude(height = " + fmtNumber(params.height, 10) + ")";
  if (operation === "union" || operation === "difference" || operation === "intersection") return operation + "() { ... }";
  if (operation === "duplicate") return "// duplicate selected geometry";
  if (operation === "delete") return "// delete selected geometry";
  if (operation === "rename") return "// rename " + (params.name || "object");
  if (obj) return objectCode(obj);
  return step?.label ? "// " + step.label : "";
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

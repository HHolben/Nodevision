// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationObjectFormView.mjs
// This module builds the equation-object form with shared field constructors and themeable layout defaults, leaving configuration parsing and world mutations to separate modules.

import { DEFAULT_PLANE, alphaPercentFromOpacity, syncAlphaControl } from "./equationObjectDefaults.mjs";

// Small constructors give coefficient, bound, and appearance fields consistent layout.
function element(tag, parent, css = "") {
  const node = document.createElement(tag);
  node.style.cssText = css;
  parent.appendChild(node);
  return node;
}

function label(parent, text, inline = false) {
  const node = element("label", parent, inline
    ? "display:inline-flex;align-items:center;gap:var(--nv-equation-control-gap,6px)"
    : "display:flex;flex-direction:column;gap:var(--nv-equation-label-gap,4px)");
  node.appendChild(document.createTextNode(text));
  return node;
}

function input(parent, text, type, value, step = "0.1") {
  const node = element("input", label(parent, text));
  node.type = type;
  node.value = String(value);
  if (type === "number") node.step = step;
  return node;
}

function toggle(parent, text, checked = false) {
  const node = element("input", label(parent, text, true));
  node.type = "checkbox";
  node.checked = checked;
  return node;
}

export function createEquationObjectFormView(parent) {
  const fields = {};
  const root = element("div", parent, "display:flex;flex-direction:column;gap:var(--nv-equation-form-gap,10px);font:var(--nv-equation-form-font,12px/1.35 monospace);min-width:var(--nv-equation-form-min-width,0)");
  fields.equationLine = element("div", root, "font-size:var(--nv-equation-heading-size,14px);font-weight:600");
  fields.quickInequalityInput = input(root, "Equation / Inequality", "text", "");
  fields.quickInequalityInput.placeholder = "Num = 5, a = (2, 5, 7), z < Num + a.z";
  const grid = element("div", root, "display:grid;grid-template-columns:var(--nv-equation-grid-columns,repeat(4,minmax(0,1fr)));gap:var(--nv-equation-grid-gap,8px)");

  // Populate numeric fields from the same defaults used by configuration parsing.
  for (const key of ["a", "b", "c", "d"]) {
    fields[key + "Input"] = input(grid, key.toUpperCase(), "number", DEFAULT_PLANE[key]);
  }
  for (const axis of ["x", "y", "z"]) {
    for (const end of ["min", "max"]) {
      const key = axis + end;
      fields[key + "Input"] = input(grid, axis.toUpperCase() + " " + (end === "min" ? "Min" : "Max"), "number", DEFAULT_PLANE[key], "1");
    }
  }
  fields.depthInput = input(grid, "Depth", "number", DEFAULT_PLANE.thickness, "0.05");
  fields.depthInput.min = "0.02";
  fields.colorInput = input(grid, "Color", "color", DEFAULT_PLANE.color);
  const alphaWrap = element("span", label(grid, "Alpha"), "display:flex;align-items:center;gap:var(--nv-equation-grid-gap,8px)");
  fields.alphaInput = element("input", alphaWrap);
  fields.alphaInput.type = "range";
  fields.alphaInput.min = "0";
  fields.alphaInput.max = "100";
  fields.alphaInput.step = "1";
  fields.alphaInput.value = String(alphaPercentFromOpacity(DEFAULT_PLANE.opacity));
  fields.alphaValue = element("span", alphaWrap);
  syncAlphaControl(fields.alphaInput, fields.alphaValue);
  fields.alphaInput.addEventListener("input", () => syncAlphaControl(fields.alphaInput, fields.alphaValue));

  // Bounds and material controls share compact rows while retaining native labels.
  const rowStyle = "display:flex;align-items:center;gap:var(--nv-equation-row-gap,12px);flex-wrap:wrap";
  const bounds = element("div", root, rowStyle);
  for (const axis of ["X", "Y", "Z"]) fields["bound" + axis + "Input"] = toggle(bounds, "Bound " + axis);
  const materialRow = element("div", root, rowStyle);
  fields.colliderInput = toggle(materialRow, "Collider", true);
  fields.materialSelect = element("select", label(materialRow, "Material", true));
  fields.waterSideSelect = element("select", materialRow);
  fields.waterSideSelect.setAttribute("aria-label", "Liquid side");
  for (const [value, text] of [["negative", "Liquid: equation < 0"], ["positive", "Liquid: equation > 0"]]) {
    const option = element("option", fields.waterSideSelect);
    option.value = value;
    option.textContent = text;
  }
  fields.modeLine = element("div", materialRow, "opacity:var(--nv-equation-mode-opacity,0.82)");
  fields.statusLine = element("div", root, "opacity:var(--nv-equation-status-opacity,0.85)");
  fields.statusLine.setAttribute("role", "status");
  const buttons = element("div", root, "display:flex;gap:var(--nv-equation-grid-gap,8px);flex-wrap:wrap");
  for (const [key, text] of [["insertBtn", "Insert Object"], ["applyBtn", "Apply To Selected"], ["closeBtn", "Close"]]) {
    fields[key] = element("button", buttons);
    fields[key].type = "button";
    fields[key].textContent = text;
  }
  return fields;
}

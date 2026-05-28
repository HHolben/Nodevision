// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/equationColliderWidget.mjs
// Renders Insert > Equation Object controls for Meta World editor mode.

import { setStatus } from "/StatusBar.mjs";

const DEFAULT_PLANE = {
  a: 0,
  b: 1,
  c: 0,
  d: 0,
  xmin: -15,
  xmax: 15,
  ymin: -15,
  ymax: 15,
  zmin: -15,
  zmax: 15,
  thickness: 0.2
};

function getController() {
  return window.VRWorldContext?.equationColliderController || null;
}

function makeNumber(label, value, { step = "0.1", min = null } = {}) {
  const wrap = document.createElement("label");
  wrap.className = "nv-equation-collider-field";
  wrap.textContent = label;

  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  input.step = step;
  if (min !== null) input.min = String(min);
  wrap.appendChild(input);
  return { wrap, input };
}

function makeCheckbox(label, checked = true) {
  const wrap = document.createElement("label");
  wrap.className = "nv-equation-collider-field";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;

  wrap.appendChild(input);
  wrap.appendChild(document.createTextNode(label));
  return { wrap, input };
}

function makeButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.();
  });
  return button;
}

function readNumber(input, fallback) {
  const n = Number.parseFloat(input?.value);
  return Number.isFinite(n) ? n : fallback;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = "";
  hostElement.classList.add("nv-equation-collider-toolbar");

  const controller = getController();
  if (!controller?.addPlane) {
    hostElement.appendChild(document.createTextNode("Open a Meta World editor to insert equation objects."));
    setStatus("Open a Meta World editor before inserting equation objects.");
    return;
  }

  const a = makeNumber("A", DEFAULT_PLANE.a, { step: "0.1" });
  const b = makeNumber("B", DEFAULT_PLANE.b, { step: "0.1" });
  const c = makeNumber("C", DEFAULT_PLANE.c, { step: "0.1" });
  const d = makeNumber("D", DEFAULT_PLANE.d, { step: "0.1" });
  const xmin = makeNumber("X Min", DEFAULT_PLANE.xmin, { step: "1" });
  const xmax = makeNumber("X Max", DEFAULT_PLANE.xmax, { step: "1" });
  const ymin = makeNumber("Y Min", DEFAULT_PLANE.ymin, { step: "1" });
  const ymax = makeNumber("Y Max", DEFAULT_PLANE.ymax, { step: "1" });
  const zmin = makeNumber("Z Min", DEFAULT_PLANE.zmin, { step: "1" });
  const zmax = makeNumber("Z Max", DEFAULT_PLANE.zmax, { step: "1" });
  const thickness = makeNumber("Depth", DEFAULT_PLANE.thickness, { step: "0.05", min: "0.02" });
  const collider = makeCheckbox("Collider", true);

  const planeButton = makeButton("Plane", () => {
    const mesh = controller.addPlane({
      a: readNumber(a.input, DEFAULT_PLANE.a),
      b: readNumber(b.input, DEFAULT_PLANE.b),
      c: readNumber(c.input, DEFAULT_PLANE.c),
      d: readNumber(d.input, DEFAULT_PLANE.d),
      xmin: readNumber(xmin.input, DEFAULT_PLANE.xmin),
      xmax: readNumber(xmax.input, DEFAULT_PLANE.xmax),
      ymin: readNumber(ymin.input, DEFAULT_PLANE.ymin),
      ymax: readNumber(ymax.input, DEFAULT_PLANE.ymax),
      zmin: readNumber(zmin.input, DEFAULT_PLANE.zmin),
      zmax: readNumber(zmax.input, DEFAULT_PLANE.zmax),
      thickness: readNumber(thickness.input, DEFAULT_PLANE.thickness),
      collider: collider.input.checked
    });
    setStatus(mesh ? "Equation object plane inserted. Press Y on it to edit A, B, C, D." : "Could not insert equation object plane.");
  });

  [
    a.wrap,
    b.wrap,
    c.wrap,
    d.wrap,
    xmin.wrap,
    xmax.wrap,
    ymin.wrap,
    ymax.wrap,
    zmin.wrap,
    zmax.wrap,
    thickness.wrap,
    collider.wrap,
    planeButton
  ].forEach((element) => hostElement.appendChild(element));
}

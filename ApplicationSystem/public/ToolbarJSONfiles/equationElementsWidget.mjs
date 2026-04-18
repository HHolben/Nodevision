// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/equationElementsWidget.mjs
// Renders Equation Editing sub-toolbar buttons for structural LaTeX elements.

const MODE = "EquationEditing";

function dispatch(actionKey) {
  const handler = window.NodevisionState?.activeActionHandler;
  if (typeof handler === "function") {
    handler(actionKey);
  }
}

function makeButton(label, actionKey) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  Object.assign(btn.style, {
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
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(actionKey);
  });
  return btn;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  if ((window.NodevisionState?.currentMode || "") !== MODE) return;

  const mount = hostElement.querySelector("#nv-equation-elements") || hostElement;
  mount.id = "nv-equation-elements";
  mount.innerHTML = "";
  mount.style.display = "flex";
  mount.style.gap = "6px";
  mount.style.flexWrap = "wrap";

  const elements = [
    { label: "∫", action: "eqInsertIntegrand" },
    { label: "∫ᵃᵇ", action: "eqInsertDefiniteIntegral" },
    { label: "∬", action: "eqInsertDoubleIntegral" },
    { label: "lim", action: "eqInsertLimit" },
    { label: "Σ", action: "eqInsertSummation" },
    { label: "Π", action: "eqInsertProduct" },
    { label: "÷", action: "eqInsertFraction" },
    { label: "Frac Bar", action: "eqInsertDisplayFraction" },
    { label: "2×2 Matrix", action: "eqInsertMatrix" },
    { label: "3×3 Matrix", action: "eqInsertMatrix3x3" },
    { label: "m×n Matrix", action: "eqInsertMatrixGeneral" },
    { label: "!", action: "eqInsertFactorial" },
    { label: "xⁿ", action: "eqInsertSuperscript" },
    { label: "x̂", action: "eqInsertHat" },
    { label: "xₙ", action: "eqInsertSubscript" },
    { label: "·", action: "eqInsertDotProduct" },
    { label: "×", action: "eqInsertCrossProduct" },
  ];

  elements.forEach(({ label, action }) => {
    mount.appendChild(makeButton(label, action));
  });
}

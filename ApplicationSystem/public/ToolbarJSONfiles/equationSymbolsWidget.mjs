// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/equationSymbolsWidget.mjs
// Renders Equation Editing sub-toolbar buttons for common math symbols.

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

  const mount = hostElement.querySelector("#nv-equation-symbols") || hostElement;
  mount.id = "nv-equation-symbols";
  mount.innerHTML = "";
  mount.style.display = "flex";
  mount.style.gap = "6px";

  const symbols = [
    { label: "α", action: "eqInsertSymbolAlpha" },
    { label: "β", action: "eqInsertSymbolBeta" },
    { label: "γ", action: "eqInsertSymbolGamma" },
    { label: "θ", action: "eqInsertSymbolTheta" },
    { label: "π", action: "eqInsertSymbolPi" },
    { label: "σ", action: "eqInsertSymbolSigma" },
    { label: "∞", action: "eqInsertSymbolInfinity" },
    { label: "±", action: "eqInsertSymbolPlusMinus" },
  ];

  symbols.forEach(({ label, action }) => {
    mount.appendChild(makeButton(label, action));
  });
}

// Nodevision/ApplicationSystem/public/Equation/EquationExpressionEditor.mjs
// This module defines reusable equation input and toolbar surfaces for Nodevision editors. The component inserts equation snippets into focused text fields and emits plain strings for callers.

export const EQUATION_TOOL_GROUPS = {
  elements: [
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
  ],
  symbols: [
    { label: "α", action: "eqInsertSymbolAlpha" },
    { label: "β", action: "eqInsertSymbolBeta" },
    { label: "γ", action: "eqInsertSymbolGamma" },
    { label: "θ", action: "eqInsertSymbolTheta" },
    { label: "π", action: "eqInsertSymbolPi" },
    { label: "σ", action: "eqInsertSymbolSigma" },
    { label: "∞", action: "eqInsertSymbolInfinity" },
    { label: "±", action: "eqInsertSymbolPlusMinus" },
  ],
};

const DEFAULT_EXPRESSION_VARIABLES = ["x", "y", "z", "t", "time"];
const DEFAULT_EXPRESSION_FUNCTIONS = ["sin", "cos", "tan", "sqrt", "abs", "floor", "ceil", "min", "max", "exp", "log"];
const DEFAULT_EXPRESSION_CONSTANTS = ["pi", "e", "tau", "phi", "sqrt2"];

const ACTION_SNIPPETS = {
  latex: {
    eqInsertIntegrand: ["\\int ", null],
    eqInsertDefiniteIntegral: ["\\int_{a}^{b} f(x)\\,dx", "f(x)"],
    eqInsertDoubleIntegral: ["\\iint_{D} f(x,y)\\,dA", "f(x,y)"],
    eqInsertLimit: ["\\lim_{x \\to \\infty} ", null],
    eqInsertSummation: ["\\sum_{i=0}^{n} ", null],
    eqInsertProduct: ["\\prod_{i=1}^{n} ", null],
    eqInsertFraction: ["\\frac{ }{ }", "{ "],
    eqInsertDisplayFraction: ["\\dfrac{ }{ }", "{ "],
    eqInsertMatrix: ["\\begin{bmatrix}a_{11} & a_{12} \\\\ a_{21} & a_{22}\\end{bmatrix}", "a_{11}"],
    eqInsertMatrix3x3: ["\\begin{bmatrix}a_{11} & a_{12} & a_{13} \\\\ a_{21} & a_{22} & a_{23} \\\\ a_{31} & a_{32} & a_{33}\\end{bmatrix}", "a_{11}"],
    eqInsertMatrixGeneral: ["\\begin{bmatrix}a_{11} & \\cdots & a_{1n} \\\\ \\vdots & \\ddots & \\vdots \\\\ a_{m1} & \\cdots & a_{mn}\\end{bmatrix}", "a_{11}"],
    eqInsertFactorial: ["n!", null],
    eqInsertSuperscript: ["^{ }", "{ "],
    eqInsertSubscript: ["_{ }", "{ "],
    eqInsertHat: ["\\hat{ }", "{ "],
    eqInsertDotProduct: ["\\cdot ", null],
    eqInsertCrossProduct: ["\\times ", null],
    eqInsertSymbolAlpha: ["\\alpha ", null],
    eqInsertSymbolBeta: ["\\beta ", null],
    eqInsertSymbolGamma: ["\\gamma ", null],
    eqInsertSymbolTheta: ["\\theta ", null],
    eqInsertSymbolPi: ["\\pi ", null],
    eqInsertSymbolSigma: ["\\sigma ", null],
    eqInsertSymbolInfinity: ["\\infty ", null],
    eqInsertSymbolPlusMinus: ["\\pm ", null],
  },
  expression: {
    eqInsertIntegrand: ["integral()", "("],
    eqInsertDefiniteIntegral: ["integral(a, b, f(x))", "f(x)"],
    eqInsertDoubleIntegral: ["integral2d(f(x, y))", "f(x, y)"],
    eqInsertLimit: ["limit()", "("],
    eqInsertSummation: ["sum()", "("],
    eqInsertProduct: ["product()", "("],
    eqInsertFraction: ["() / ()", "("],
    eqInsertDisplayFraction: ["() / ()", "("],
    eqInsertMatrix: ["[[a11, a12], [a21, a22]]", "a11"],
    eqInsertMatrix3x3: ["[[a11, a12, a13], [a21, a22, a23], [a31, a32, a33]]", "a11"],
    eqInsertMatrixGeneral: ["[[a11, ..., a1n], ..., [am1, ..., amn]]", "a11"],
    eqInsertFactorial: ["!", null],
    eqInsertSuperscript: ["^()", "("],
    eqInsertSubscript: ["_", null],
    eqInsertHat: ["^()", "("],
    eqInsertDotProduct: [" * ", null],
    eqInsertCrossProduct: [" * ", null],
    eqInsertSymbolAlpha: ["alpha", null],
    eqInsertSymbolBeta: ["beta", null],
    eqInsertSymbolGamma: ["gamma", null],
    eqInsertSymbolTheta: ["theta", null],
    eqInsertSymbolPi: ["pi", null],
    eqInsertSymbolSigma: ["sigma", null],
    eqInsertSymbolInfinity: ["1e308", null],
    eqInsertSymbolPlusMinus: ["+-", null],
  },
  html: {
    eqInsertIntegrand: ["∫()", "("],
    eqInsertDefiniteIntegral: ["∫[a,b](f(x))", "f(x)"],
    eqInsertDoubleIntegral: ["∬[D](f(x,y))", "f(x,y)"],
    eqInsertLimit: ["lim(x→∞)", "x"],
    eqInsertSummation: ["Σ()", "("],
    eqInsertProduct: ["Π()", "("],
    eqInsertFraction: ["÷", null],
    eqInsertDisplayFraction: ["(a)/(b)", "a"],
    eqInsertMatrix: ["[[a11,a12],[a21,a22]]", "a11"],
    eqInsertMatrix3x3: ["[[a11,a12,a13],[a21,a22,a23],[a31,a32,a33]]", "a11"],
    eqInsertMatrixGeneral: ["[[a11,…,a1n],…,[am1,…,amn]]", "a11"],
    eqInsertFactorial: ["!", null],
    eqInsertSuperscript: ["^n", "n"],
    eqInsertHat: ["^", null],
    eqInsertSubscript: ["_n", "n"],
    eqInsertDotProduct: ["·", null],
    eqInsertCrossProduct: ["×", null],
    eqInsertSymbolAlpha: ["α", null],
    eqInsertSymbolBeta: ["β", null],
    eqInsertSymbolGamma: ["γ", null],
    eqInsertSymbolTheta: ["θ", null],
    eqInsertSymbolPi: ["π", null],
    eqInsertSymbolSigma: ["σ", null],
    eqInsertSymbolInfinity: ["∞", null],
    eqInsertSymbolPlusMinus: ["±", null],
  },
};

function normalizeArray(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback;
}

export function getEquationActionSnippet(actionKey, { dialect = "latex" } = {}) {
  const pair = ACTION_SNIPPETS[dialect]?.[actionKey] || ACTION_SNIPPETS.latex[actionKey] || ["", null];
  return { snippet: pair[0], caretHint: pair[1] };
}

export function insertSnippetAtInput(input, snippet = "", caretHint = null) {
  if (!input) return "";
  const value = String(input.value || "");
  const start = Number.isFinite(input.selectionStart) ? input.selectionStart : value.length;
  const end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : value.length;
  input.value = value.slice(0, start) + snippet + value.slice(end);

  let nextPos = start + snippet.length;
  if (typeof caretHint === "number") {
    nextPos = start + caretHint;
  } else if (typeof caretHint === "string") {
    const idx = snippet.indexOf(caretHint);
    if (idx >= 0) nextPos = start + idx + caretHint.length;
  }
  input.selectionStart = input.selectionEnd = Math.min(input.value.length, Math.max(0, nextPos));
  input.focus();
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input.value;
}

export function applyEquationActionToInput(input, actionKey, { dialect = "latex", onChange = null } = {}) {
  const { snippet, caretHint } = getEquationActionSnippet(actionKey, { dialect });
  if (!snippet) return false;
  const value = insertSnippetAtInput(input, snippet, caretHint);
  onChange?.(value, { actionKey, snippet });
  return true;
}

export function createEquationToolButton({ label, action, onAction, compact = false } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label || action || "?";
  btn.title = label || action || "Equation tool";
  Object.assign(btn.style, {
    height: compact ? "24px" : "28px",
    padding: compact ? "0 7px" : "0 10px",
    border: "1px solid #333",
    borderRadius: "4px",
    background: "#eee",
    cursor: "pointer",
    fontSize: compact ? "11px" : "12px",
    lineHeight: compact ? "24px" : "28px",
    whiteSpace: "nowrap",
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAction?.(action);
  });
  return btn;
}

export function renderEquationToolbarGroup(hostElement, { group = "elements", onAction = null, compact = false } = {}) {
  if (!hostElement) return null;
  hostElement.innerHTML = "";
  Object.assign(hostElement.style, {
    display: "flex",
    gap: compact ? "4px" : "6px",
    flexWrap: "wrap",
  });
  const actions = EQUATION_TOOL_GROUPS[group] || [];
  actions.forEach((tool) => hostElement.appendChild(createEquationToolButton({ ...tool, onAction, compact })));
  return hostElement;
}

function createTokenButton(label, snippet, input, onChange, compact) {
  return createEquationToolButton({
    label,
    action: snippet,
    compact,
    onAction: () => {
      insertSnippetAtInput(input, snippet, snippet.endsWith("()") ? "(" : null);
    },
  });
}

function renderExpressionSpecificTools(host, input, options) {
  const { allowedVariables, allowedFunctions, allowedConstants, compact, onChange } = options;
  const variables = normalizeArray(allowedVariables, DEFAULT_EXPRESSION_VARIABLES);
  const functions = normalizeArray(allowedFunctions, DEFAULT_EXPRESSION_FUNCTIONS);
  const constants = normalizeArray(allowedConstants, DEFAULT_EXPRESSION_CONSTANTS);

  const variableRow = document.createElement("div");
  Object.assign(variableRow.style, { display: "flex", gap: "4px", flexWrap: "wrap" });
  variables.forEach((name) => variableRow.appendChild(createTokenButton(name, name, input, onChange, compact)));
  host.appendChild(variableRow);

  const constantRow = document.createElement("div");
  Object.assign(constantRow.style, { display: "flex", gap: "4px", flexWrap: "wrap" });
  constants.forEach((name) => constantRow.appendChild(createTokenButton(name, name, input, onChange, compact)));
  host.appendChild(constantRow);

  const functionRow = document.createElement("div");
  Object.assign(functionRow.style, { display: "flex", gap: "4px", flexWrap: "wrap" });
  functions.forEach((name) => functionRow.appendChild(createTokenButton(name, `${name}()`, input, onChange, compact)));
  host.appendChild(functionRow);
}

export function createEquationExpressionEditor({
  initialExpressionText = "",
  currentExpressionText = null,
  onChange = null,
  allowedVariables = DEFAULT_EXPRESSION_VARIABLES,
  allowedFunctions = DEFAULT_EXPRESSION_FUNCTIONS,
  allowedConstants = DEFAULT_EXPRESSION_CONSTANTS,
  compactMode = false,
  panelRowMode = false,
  dialect = "expression",
  placeholder = "z = sin(x) * cos(y)",
  multiline = false,
  collapsedTools = true,
} = {}) {
  const root = document.createElement("div");
  root.className = "nv-equation-expression-editor";
  Object.assign(root.style, {
    display: "grid",
    gap: compactMode || panelRowMode ? "4px" : "8px",
    minWidth: "0",
  });

  const input = multiline ? document.createElement("textarea") : document.createElement("input");
  if (!multiline) input.type = "text";
  input.value = currentExpressionText == null ? String(initialExpressionText || "") : String(currentExpressionText || "");
  input.placeholder = placeholder;
  input.spellcheck = false;
  Object.assign(input.style, {
    boxSizing: "border-box",
    width: "100%",
    minWidth: "0",
    fontSize: compactMode || panelRowMode ? "12px" : "14px",
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    padding: compactMode || panelRowMode ? "3px 5px" : "7px 8px",
  });
  if (multiline) input.rows = compactMode ? 2 : 5;
  input.addEventListener("focus", () => {
    activeEquationInput = input;
  });
  input.addEventListener("pointerdown", () => {
    activeEquationInput = input;
  });
  input.addEventListener("input", () => onChange?.(input.value, { source: "keyboard" }));
  root.appendChild(input);

  const toolsHost = document.createElement("div");
  Object.assign(toolsHost.style, {
    display: "grid",
    gap: compactMode || panelRowMode ? "4px" : "6px",
  });

  const renderTools = () => {
    toolsHost.innerHTML = "";
    if (dialect === "expression") {
      renderExpressionSpecificTools(toolsHost, input, { allowedVariables, allowedFunctions, allowedConstants, compact: true, onChange });
    }
    const elementRow = document.createElement("div");
    renderEquationToolbarGroup(elementRow, {
      group: "elements",
      compact: compactMode || panelRowMode,
      onAction: (actionKey) => applyEquationActionToInput(input, actionKey, { dialect }),
    });
    toolsHost.appendChild(elementRow);

    const symbolRow = document.createElement("div");
    renderEquationToolbarGroup(symbolRow, {
      group: "symbols",
      compact: compactMode || panelRowMode,
      onAction: (actionKey) => applyEquationActionToInput(input, actionKey, { dialect }),
    });
    toolsHost.appendChild(symbolRow);
  };
  renderTools();

  if (collapsedTools && (compactMode || panelRowMode)) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Math tools";
    Object.assign(summary.style, { cursor: "pointer", fontSize: "11px", color: "#444" });
    details.appendChild(summary);
    details.appendChild(toolsHost);
    root.appendChild(details);
  } else {
    root.appendChild(toolsHost);
  }

  return {
    root,
    input,
    getValue: () => input.value,
    setValue(value = "") {
      input.value = String(value || "");
      onChange?.(input.value, { source: "setValue" });
    },
    focus() {
      input.focus();
    },
    insertAction(actionKey) {
      return applyEquationActionToInput(input, actionKey, { dialect });
    },
    insertSnippet(snippet, caretHint = null) {
      return insertSnippetAtInput(input, snippet, caretHint);
    },
    destroy() {},
  };
}

let activeEquationInput = null;

export function setActiveEquationInput(input) {
  activeEquationInput = input || null;
}

export function getActiveEquationInput() {
  return activeEquationInput;
}

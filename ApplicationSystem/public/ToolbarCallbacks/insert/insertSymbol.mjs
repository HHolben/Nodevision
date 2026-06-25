// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertSymbol.mjs
// Opens a lightweight unicode symbol picker for Insert -> Text -> Symbol.

import { setStatus } from "/StatusBar.mjs";

const PANEL_ID = "nv-symbol-picker-overlay";

const SYMBOL_GROUPS = [
  {
    name: "Common",
    symbols: [
      ["©", "Copyright"], ["®", "Registered"], ["™", "Trademark"], ["§", "Section"],
      ["¶", "Pilcrow"], ["•", "Bullet"], ["…", "Ellipsis"], ["—", "Em dash"],
      ["–", "En dash"], ["°", "Degree"], ["±", "Plus minus"], ["×", "Times"],
      ["÷", "Divide"], ["µ", "Micro"], ["∞", "Infinity"], ["№", "Numero"],
    ],
  },
  {
    name: "Math",
    symbols: [
      ["≠", "Not equal"], ["≈", "Approximately"], ["≤", "Less equal"], ["≥", "Greater equal"],
      ["√", "Square root"], ["∑", "Summation"], ["∏", "Product"], ["∫", "Integral"],
      ["∂", "Partial"], ["∆", "Delta"], ["∇", "Nabla"], ["∈", "Element of"],
      ["∉", "Not element of"], ["∩", "Intersection"], ["∪", "Union"], ["∴", "Therefore"],
    ],
  },
  {
    name: "Greek",
    symbols: [
      ["α", "Alpha"], ["β", "Beta"], ["γ", "Gamma"], ["δ", "Delta"],
      ["ε", "Epsilon"], ["θ", "Theta"], ["λ", "Lambda"], ["μ", "Mu"],
      ["π", "Pi"], ["ρ", "Rho"], ["σ", "Sigma"], ["τ", "Tau"],
      ["φ", "Phi"], ["χ", "Chi"], ["ψ", "Psi"], ["ω", "Omega"],
      ["Γ", "Gamma uppercase"], ["Δ", "Delta uppercase"], ["Σ", "Sigma uppercase"], ["Ω", "Omega uppercase"],
    ],
  },
  {
    name: "Arrows",
    symbols: [
      ["←", "Left arrow"], ["↑", "Up arrow"], ["→", "Right arrow"], ["↓", "Down arrow"],
      ["↔", "Left right arrow"], ["↕", "Up down arrow"], ["⇒", "Double right arrow"], ["⇐", "Double left arrow"],
      ["⇔", "Double left right arrow"], ["↦", "Maps to"], ["↩", "Return arrow"], ["↪", "Hook arrow"],
    ],
  },
  {
    name: "Currency",
    symbols: [
      ["¢", "Cent"], ["£", "Pound"], ["¥", "Yen"], ["€", "Euro"],
      ["₹", "Rupee"], ["₩", "Won"], ["₿", "Bitcoin"], ["¤", "Currency"],
    ],
  },
  {
    name: "Shapes",
    symbols: [
      ["★", "Star"], ["☆", "Star outline"], ["◆", "Diamond"], ["◇", "Diamond outline"],
      ["●", "Circle"], ["○", "Circle outline"], ["■", "Square"], ["□", "Square outline"],
      ["▲", "Triangle up"], ["▼", "Triangle down"], ["◆", "Diamond solid"], ["◊", "Lozenge"],
    ],
  },
];

function ensureStyles() {
  if (document.getElementById("nv-symbol-picker-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-symbol-picker-styles";
  style.textContent = `
    #${PANEL_ID} { position:fixed; inset:0; z-index:2147483000; display:flex; align-items:center; justify-content:center; background:rgba(15,23,42,0.38); }
    #${PANEL_ID} .nv-symbol-panel { width:min(720px, calc(100vw - 32px)); max-height:min(680px, calc(100vh - 32px)); display:grid; grid-template-rows:auto auto 1fr; background:#fff; color:#111827; border:1px solid #334155; box-shadow:0 18px 50px rgba(15,23,42,0.35); border-radius:8px; overflow:hidden; font:13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    #${PANEL_ID} .nv-symbol-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border-bottom:1px solid #d1d5db; background:#f8fafc; }
    #${PANEL_ID} .nv-symbol-title { font-weight:700; }
    #${PANEL_ID} .nv-symbol-close { width:28px; height:28px; border:1px solid #94a3b8; background:#fff; border-radius:4px; cursor:pointer; }
    #${PANEL_ID} .nv-symbol-search { padding:10px 12px; border-bottom:1px solid #e5e7eb; }
    #${PANEL_ID} .nv-symbol-search input { width:100%; box-sizing:border-box; height:32px; border:1px solid #94a3b8; border-radius:4px; padding:4px 8px; font:inherit; }
    #${PANEL_ID} .nv-symbol-body { overflow:auto; padding:12px; }
    #${PANEL_ID} .nv-symbol-group { margin:0 0 16px; }
    #${PANEL_ID} .nv-symbol-group h3 { margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:0; color:#475569; }
    #${PANEL_ID} .nv-symbol-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(46px, 1fr)); gap:6px; }
    #${PANEL_ID} .nv-symbol-button { height:42px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; cursor:pointer; font-size:22px; line-height:1; }
    #${PANEL_ID} .nv-symbol-button:hover, #${PANEL_ID} .nv-symbol-button:focus { border-color:#2563eb; background:#eff6ff; outline:none; }
    #${PANEL_ID} .nv-symbol-empty { color:#64748b; padding:18px 4px; }
    html[data-nv-theme="dark"] #${PANEL_ID} .nv-symbol-panel { background:#111827; color:#f8fafc; border-color:#475569; }
    html[data-nv-theme="dark"] #${PANEL_ID} .nv-symbol-header { background:#1f2937; border-bottom-color:#374151; }
    html[data-nv-theme="dark"] #${PANEL_ID} .nv-symbol-search { border-bottom-color:#374151; }
    html[data-nv-theme="dark"] #${PANEL_ID} .nv-symbol-search input, html[data-nv-theme="dark"] #${PANEL_ID} .nv-symbol-close, html[data-nv-theme="dark"] #${PANEL_ID} .nv-symbol-button { background:#020617; color:#f8fafc; border-color:#475569; }
    html[data-nv-theme="dark"] #${PANEL_ID} .nv-symbol-button:hover, html[data-nv-theme="dark"] #${PANEL_ID} .nv-symbol-button:focus { background:#172554; border-color:#60a5fa; }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function activeTextControl() {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return el;
  if (el instanceof HTMLInputElement) {
    const type = String(el.type || "text").toLowerCase();
    return ["text", "search", "url", "email", "tel", "password"].includes(type) ? el : null;
  }
  return null;
}

function insertIntoTextControl(control, text) {
  const start = Number.isFinite(control.selectionStart) ? control.selectionStart : control.value.length;
  const end = Number.isFinite(control.selectionEnd) ? control.selectionEnd : start;
  control.value = control.value.slice(0, start) + text + control.value.slice(end);
  control.selectionStart = control.selectionEnd = start + text.length;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.focus();
  return true;
}

function insertIntoMonaco(text) {
  const editor = window.monacoEditor;
  if (!editor || typeof editor.getSelection !== "function" || typeof editor.executeEdits !== "function") return false;
  const selection = editor.getSelection();
  if (!selection) return false;
  editor.executeEdits("insert-symbol", [{ range: selection, text, forceMoveMarkers: true }]);
  editor.focus?.();
  return true;
}

function insertIntoContentEditable(text) {
  const active = document.activeElement;
  const editable = active?.closest?.("[contenteditable=true]") || document.querySelector("#wysiwyg[contenteditable=true]");
  if (!editable) return false;
  editable.focus();
  document.execCommand("insertText", false, text);
  return true;
}

function insertSymbol(symbol, rememberedTextControl) {
  const control = rememberedTextControl?.isConnected ? rememberedTextControl : activeTextControl();
  if (control && insertIntoTextControl(control, symbol)) {
    setStatus("Symbol", "Inserted " + symbol);
    return;
  }

  const mode = window.NodevisionState?.currentMode || window.currentMode || "";
  if (String(mode).toLowerCase().includes("code") && insertIntoMonaco(symbol)) {
    setStatus("Symbol", "Inserted " + symbol);
    return;
  }

  const tools = window.HTMLWysiwygTools;
  if (tools && typeof tools.insertHTMLAtCaret === "function" && document.querySelector("#wysiwyg[contenteditable=true]")) {
    tools.restoreSavedSelection?.();
    tools.insertHTMLAtCaret(escapeHtml(symbol));
    setStatus("Symbol", "Inserted " + symbol);
    return;
  }

  if (insertIntoMonaco(symbol) || insertIntoContentEditable(symbol)) {
    setStatus("Symbol", "Inserted " + symbol);
    return;
  }

  navigator.clipboard?.writeText(symbol).catch(() => {});
  setStatus("Symbol", "Copied " + symbol);
}

function symbolMatches(symbol, label, query) {
  if (!query) return true;
  const haystack = `${symbol} ${label} ${symbol.codePointAt(0).toString(16)}`.toLowerCase();
  return haystack.includes(query);
}

function renderSymbols(body, query, rememberedTextControl) {
  body.innerHTML = "";
  let count = 0;
  for (const group of SYMBOL_GROUPS) {
    const matches = group.symbols.filter(([symbol, label]) => symbolMatches(symbol, label, query));
    if (!matches.length) continue;
    const section = document.createElement("section");
    section.className = "nv-symbol-group";
    const heading = document.createElement("h3");
    heading.textContent = group.name;
    const grid = document.createElement("div");
    grid.className = "nv-symbol-grid";
    for (const [symbol, label] of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nv-symbol-button";
      button.textContent = symbol;
      button.title = `${label} U+${symbol.codePointAt(0).toString(16).toUpperCase()}`;
      button.addEventListener("click", () => insertSymbol(symbol, rememberedTextControl));
      grid.appendChild(button);
      count += 1;
    }
    section.append(heading, grid);
    body.appendChild(section);
  }
  if (!count) {
    const empty = document.createElement("div");
    empty.className = "nv-symbol-empty";
    empty.textContent = "No symbols match.";
    body.appendChild(empty);
  }
}

export default function insertSymbolPicker() {
  document.getElementById(PANEL_ID)?.remove();
  ensureStyles();
  window.HTMLWysiwygTools?.saveCurrentSelection?.();
  const rememberedTextControl = activeTextControl();

  const overlay = document.createElement("div");
  overlay.id = PANEL_ID;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });

  const panel = document.createElement("div");
  panel.className = "nv-symbol-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Unicode symbols");

  const header = document.createElement("div");
  header.className = "nv-symbol-header";
  const title = document.createElement("div");
  title.className = "nv-symbol-title";
  title.textContent = "Unicode Symbols";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "nv-symbol-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close symbol picker");
  close.addEventListener("click", () => overlay.remove());
  header.append(title, close);

  const searchWrap = document.createElement("div");
  searchWrap.className = "nv-symbol-search";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search symbols";
  searchWrap.appendChild(search);

  const body = document.createElement("div");
  body.className = "nv-symbol-body";
  panel.append(header, searchWrap, body);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const refresh = () => renderSymbols(body, search.value.trim().toLowerCase(), rememberedTextControl);
  search.addEventListener("input", refresh);
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") overlay.remove();
  });
  refresh();
  search.focus();
}

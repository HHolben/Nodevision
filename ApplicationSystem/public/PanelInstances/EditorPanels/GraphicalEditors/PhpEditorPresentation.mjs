// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorPresentation.mjs
// This module owns PHP syntax presentation and the shared editor stylesheet.


export const PHP_KEYWORDS = new Set([
  "if", "else", "elseif", "while", "for", "foreach", "function", "class", "public", "private",
  "protected", "static", "return", "new", "switch", "case", "break", "continue", "try", "catch",
  "throw", "namespace", "use", "echo", "print", "true", "false", "null", "const", "final", "extends"
]);

export function escapeHTML(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function createStyleTagOnce() {
  if (document.getElementById("nv-php-editor-style")) return;
  const style = document.createElement("style");
  style.id = "nv-php-editor-style";
  style.textContent = `
    .nv-php-root { display:flex; flex-direction:column; width:100%; height:100%; overflow:hidden; font-family:monospace; }
    .nv-php-layout { display:grid; grid-template-rows:minmax(260px, 1fr) minmax(280px, 0.9fr); flex:1; min-height:0; overflow:hidden; }
    .nv-php-pane { min-width:0; min-height:0; overflow:hidden; border-bottom:1px solid #e1e1e1; }
    .nv-php-pane:last-child { border-bottom:none; }
    .nv-php-editor-wrap { position:relative; width:100%; height:100%; background:#14161c; color:#e9efff; }
    .nv-php-highlight { position:absolute; inset:0; margin:0; padding:12px; overflow:auto; white-space:pre; pointer-events:none; font:13px/1.45 monospace; }
    .nv-php-input { position:absolute; inset:0; margin:0; border:none; resize:none; outline:none; padding:12px; background:transparent; color:transparent; caret-color:#f2f7ff; font:13px/1.45 monospace; }
    .nv-php-right { display:grid; grid-template-rows:56% 44%; height:100%; min-height:0; }
    .nv-php-preview-wrap { border-bottom:1px solid #e1e1e1; display:flex; flex-direction:column; min-height:0; }
    .nv-php-preview-title { padding:6px 8px; border-bottom:1px solid #e1e1e1; background:#fafafa; font:12px monospace; }
    .nv-php-preview { flex:1; width:100%; border:none; background:#fff; }
    .nv-php-dashboard-wrap { display:flex; flex-direction:column; min-height:0; }
    .nv-php-dashboard-title { padding:6px 8px; border-bottom:1px solid #e1e1e1; background:#fafafa; font:12px monospace; }
    .nv-php-dashboard { flex:1; min-height:0; overflow:auto; background:#fff; padding:8px; display:grid; grid-template-columns:repeat(2, minmax(180px, 1fr)); gap:8px; }
    .nv-php-widget { border:1px solid #ddd; border-radius:6px; padding:8px; background:#fcfcfc; min-height:120px; }
    .nv-php-widget h4 { margin:0 0 8px; font:12px monospace; }
    .nv-php-oscilloscope, .nv-php-graph { width:100%; height:80px; border:1px solid #cfcfcf; background:#121212; }
    .nv-php-meter { width:100%; }
    .nv-php-led { width:16px; height:16px; border-radius:50%; border:1px solid #444; background:#4d4d4d; box-shadow:inset 0 0 2px rgba(0,0,0,0.6); }
    .nv-php-led.on { background:#24d35f; box-shadow:0 0 8px rgba(36, 211, 95, 0.8); }
    .nv-php-grid { display:grid; grid-template-columns:repeat(2, minmax(240px, 1fr)); gap:10px; }
    .nv-php-card { border:1px solid #ddd; border-radius:6px; background:#fff; padding:8px; }
    .nv-php-card h3 { margin:0 0 6px; font:12px monospace; }
    .nv-php-list { margin:0; padding-left:18px; font:12px monospace; max-height:140px; overflow:auto; }
    .nv-php-label { display:block; margin-bottom:6px; font:12px monospace; }
    .nv-php-label input, .nv-php-label select { width:100%; box-sizing:border-box; margin-top:3px; font:12px monospace; }
    .nv-php-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
    .nv-php-actions button { padding:4px 10px; font:12px monospace; }
    .nv-php-status { padding:6px 8px; border-top:1px solid #ddd; background:#f7f7f7; font:11px monospace; color:#1a1a1a; }
    .nv-kw { color:#ffb86b; } .nv-var { color:#7dd3fc; } .nv-num { color:#9be564; } .nv-str { color:#f3f99d; } .nv-com { color:#7f8c8d; }
  `;
  document.head.appendChild(style);
}

export function highlightPHP(source = "") {
  const escaped = escapeHTML(source);
  return escaped
    .replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="nv-com">$1</span>')
    .replace(/(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g, '<span class="nv-str">$&</span>')
    .replace(/\$[a-zA-Z_]\w*/g, '<span class="nv-var">$&</span>')
    .replace(/\b\d+(?:\.\d+)?\b/g, '<span class="nv-num">$&</span>')
    .replace(/\b[a-zA-Z_]\w*\b/g, (word) => (PHP_KEYWORDS.has(word) ? `<span class="nv-kw">${word}</span>` : word));
}

// Nodevision/public/ToolbarCallbacks/edit/fontSelection.mjs
// Renders a font selection widget in the sub-toolbar for HTML and PHP editors.

const FONT_STORAGE_KEY_HTML = "nodevision.fontFamily.html";
const FONT_STORAGE_KEY_PHP = "nodevision.fontFamily.php";

const FONT_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial" },
  { label: "Verdana", value: "Verdana" },
  { label: "Trebuchet MS", value: "Trebuchet MS" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Courier New", value: "Courier New" },
  { label: "Monospace", value: "monospace" },
  { label: "Sans-serif", value: "sans-serif" },
  { label: "Serif", value: "serif" },
];

function getActiveMode() {
  return window.NodevisionState?.currentMode || window.currentMode || "Default";
}

function getSubToolbar() {
  return document.getElementById("sub-toolbar");
}

function readStoredFont(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function storeFont(key, value) {
  try {
    if (!value) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function selectionIsInside(root) {
  try {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const node = common?.nodeType === Node.ELEMENT_NODE ? common : common?.parentElement;
    return Boolean(node && root && root.contains(node));
  } catch {
    return false;
  }
}

function applyHtmlFont(fontFamily, { applyToSelection = false } = {}) {
  const wysiwyg = document.getElementById("wysiwyg");
  if (!wysiwyg) return;

  wysiwyg.style.fontFamily = fontFamily || "";

  if (!applyToSelection) return;
  if (!selectionIsInside(wysiwyg)) return;

  try {
    wysiwyg.focus();
  } catch {
    // ignore
  }

  try {
    // Deprecated but widely supported for contentEditable.
    // Use simple font family names from the dropdown.
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("fontName", false, fontFamily || "");
  } catch {
    // ignore
  }
}

function applyPhpFont(fontFamily) {
  const input = document.querySelector(".nv-php-input");
  const highlight = document.querySelector(".nv-php-highlight");
  if (input) input.style.fontFamily = fontFamily || "";
  if (highlight) highlight.style.fontFamily = fontFamily || "";
}

function ensureFontWidget(mode) {
  const subToolbar = getSubToolbar();
  if (!subToolbar) return;

  const existing = subToolbar.querySelector('[data-nv-font-widget="true"]');
  if (existing && existing.getAttribute("data-nv-font-mode") !== mode) {
    subToolbar.innerHTML = "";
  }
  if (existing && existing.getAttribute("data-nv-font-mode") === mode) {
    // Re-apply stored font in case the editor UI mounted after the widget was created.
    const isHtml = mode === "HTMLediting";
    const storageKey = isHtml ? FONT_STORAGE_KEY_HTML : FONT_STORAGE_KEY_PHP;
    const stored = readStoredFont(storageKey);
    if (isHtml) applyHtmlFont(stored, { applyToSelection: false });
    else applyPhpFont(stored);
    subToolbar.style.display = "flex";
    return;
  }

  subToolbar.innerHTML = `
    <div data-nv-font-widget="true" data-nv-font-mode="${mode}" class="nv-subtoolbar-widget" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <strong>Font</strong>
      <label style="display:flex;align-items:center;gap:6px;">
        <span>Family</span>
        <select id="nv-font-family-select" style="min-width:220px;"></select>
      </label>
      <label id="nv-font-apply-selection-wrap" style="display:flex;align-items:center;gap:6px;">
        <input id="nv-font-apply-selection" type="checkbox" />
        <span>Apply to selection</span>
      </label>
    </div>
  `;

  subToolbar.style.display = "flex";

  const select = subToolbar.querySelector("#nv-font-family-select");
  const applyWrap = subToolbar.querySelector("#nv-font-apply-selection-wrap");
  const applyCheckbox = subToolbar.querySelector("#nv-font-apply-selection");
  if (!(select instanceof HTMLSelectElement)) return;

  const isHtml = mode === "HTMLediting";
  const storageKey = isHtml ? FONT_STORAGE_KEY_HTML : FONT_STORAGE_KEY_PHP;
  const initialValue = readStoredFont(storageKey);

  select.innerHTML = FONT_OPTIONS.map((opt) => {
    const selected = opt.value === initialValue ? " selected" : "";
    return `<option value="${String(opt.value).replaceAll('"', "&quot;")}"${selected}>${opt.label}</option>`;
  }).join("");

  if (!isHtml) {
    if (applyWrap) applyWrap.style.display = "none";
  } else if (applyCheckbox instanceof HTMLInputElement) {
    applyCheckbox.checked = false;
  }

  const applyCurrent = () => {
    const value = select.value || "";
    storeFont(storageKey, value);
    if (!window.NodevisionState) window.NodevisionState = {};
    if (isHtml) {
      window.NodevisionState.htmlFontFamily = value;
      const applyToSelection = Boolean(applyCheckbox instanceof HTMLInputElement && applyCheckbox.checked);
      applyHtmlFont(value, { applyToSelection });
    } else {
      window.NodevisionState.phpFontFamily = value;
      applyPhpFont(value);
    }
  };

  select.addEventListener("change", applyCurrent);
  if (applyCheckbox instanceof HTMLInputElement) {
    applyCheckbox.addEventListener("change", applyCurrent);
  }

  applyCurrent();
}

function removeFontWidgetIfPresent() {
  const subToolbar = getSubToolbar();
  if (!subToolbar) return;
  const existing = subToolbar.querySelector('[data-nv-font-widget="true"]');
  if (!existing) return;
  subToolbar.innerHTML = "";
  subToolbar.style.display = "none";
}

export default function fontSelection() {
  const mode = getActiveMode();
  if (mode === "HTMLediting" || mode === "PHPediting") {
    ensureFontWidget(mode);
    return;
  }
  removeFontWidgetIfPresent();
}

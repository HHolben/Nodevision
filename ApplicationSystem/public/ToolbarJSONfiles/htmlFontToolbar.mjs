// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/htmlFontToolbar.mjs
// Styles -> Font subtoolbar for the graphical HTML/WYSIWYG editor.

import { escapeHtml } from "./insertMediaCommon.mjs";
import { openInsertMediaPicker } from "./insertMediaFont.mjs";

const FONT_EXTENSIONS = [".ttf", ".otf", ".woff", ".woff2"];

const SYSTEM_FONTS = [
  { label: "Default / Inherit", value: "__inherit__" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "serif", value: "serif" },
  { label: "sans-serif", value: "sans-serif" },
  { label: "monospace", value: "monospace" },
  { label: "cursive", value: "cursive" },
  { label: "fantasy", value: "fantasy" },
];

function tools() {
  return window.HTMLWysiwygTools || {};
}

function option(label, value) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function renderDocumentFontOptions(fonts = []) {
  const unique = [];
  const seen = new Set();
  for (const item of fonts || []) {
    const family = String(item?.family || item || "").trim();
    if (!family || seen.has(family)) continue;
    seen.add(family);
    unique.push({ label: item?.label || family, value: item?.stack || family });
  }
  if (!unique.length) return "";
  return `<optgroup label="Document Fonts">${unique.map((f) => option(f.label, f.value)).join("")}</optgroup>`;
}

function renderSelect(mount) {
  const docFonts = typeof tools().getDocumentFonts === "function" ? tools().getDocumentFonts() : [];
  mount.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font:12px monospace;">
    <label style="display:flex;align-items:center;gap:6px;">Font
      <select data-field="fontSelect" style="font:12px monospace;padding:4px 6px;border:1px solid #888;background:#fff;min-width:190px;">
        <optgroup label="System Fonts">${SYSTEM_FONTS.map((f) => option(f.label, f.value)).join("")}</optgroup>
        ${renderDocumentFontOptions(docFonts)}
      </select>
    </label>
    <button type="button" data-action="notebookFont" style="font:12px monospace;padding:5px 9px;border:1px solid #333;background:#eee;cursor:pointer;">Choose Notebook Font...</button>
    <button type="button" data-action="webFont" style="font:12px monospace;padding:5px 9px;border:1px solid #333;background:#eee;cursor:pointer;">Choose Web Font...</button>
    <button type="button" data-action="refreshFonts" title="Refresh document fonts" aria-label="Refresh document fonts" style="font:12px monospace;padding:5px 8px;border:1px solid #777;background:#f4f4f4;cursor:pointer;">Refresh</button>
    <span data-field="status" style="min-width:120px;color:#555;"></span>
  </div>`;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement || hostElement.dataset.nvHtmlFontToolbarBound === "true") return;
  hostElement.dataset.nvHtmlFontToolbarBound = "true";
  const mount = hostElement.querySelector("#nv-html-font-toolbar") || hostElement;
  renderSelect(mount);

  const setStatus = (message, isError = false) => {
    const status = mount.querySelector('[data-field="status"]');
    if (!status) return;
    status.textContent = String(message || "");
    status.style.color = isError ? "#b00" : "#555";
  };

  const rememberSelection = () => {
    if (typeof tools().saveCurrentSelection === "function") tools().saveCurrentSelection();
  };

  mount.addEventListener("pointerdown", rememberSelection, true);
  mount.addEventListener("mousedown", rememberSelection, true);

  mount.addEventListener("change", async (evt) => {
    const select = evt.target?.closest?.('[data-field="fontSelect"]');
    if (!select) return;
    setStatus("");
    try {
      if (select.value === "__inherit__") {
        if (typeof tools().removeFontFamilyFromSelection !== "function") throw new Error("No active WYSIWYG editor.");
        tools().restoreSavedSelection?.();
        tools().removeFontFamilyFromSelection();
        setStatus("Font reset.");
      } else {
        if (typeof tools().applyFontFamilyToSelection !== "function") throw new Error("No active WYSIWYG editor.");
        tools().restoreSavedSelection?.();
        tools().applyFontFamilyToSelection(select.value);
        setStatus("Font applied.");
      }
      select.selectedIndex = 0;
    } catch (err) {
      console.warn("[htmlFontToolbar]", err);
      setStatus(err?.message || String(err), true);
    }
  });

  mount.addEventListener("click", async (evt) => {
    const action = evt.target?.closest?.("[data-action]")?.dataset?.action || "";
    if (!action) return;
    setStatus("");
    rememberSelection();
    try {
      if (action === "refreshFonts") {
        renderSelect(mount);
        setStatus("Fonts refreshed.");
        return;
      }

      if (action === "notebookFont" || action === "webFont") {
        if (typeof tools().applyFontReferenceToSelection !== "function") throw new Error("No active WYSIWYG editor.");
        const ref = await openInsertMediaPicker({
          mediaKind: "font",
          allowedExtensions: FONT_EXTENSIONS,
          allowNotebookFile: action === "notebookFont",
          allowExternalUrl: action === "webFont",
          allowEmbedCode: false,
        });
        if (!ref) return;
        tools().restoreSavedSelection?.();
        await tools().applyFontReferenceToSelection(ref);
        renderSelect(mount);
        setStatus("Font applied.");
      }
    } catch (err) {
      console.warn("[htmlFontToolbar]", err);
      setStatus(err?.message || String(err), true);
    }
  });
}

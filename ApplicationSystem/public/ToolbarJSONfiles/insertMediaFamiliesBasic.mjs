// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaFamiliesBasic.mjs
// Basic Insert Media family renderer (generic links / placeholders).

import { escapeHtml, getActiveEditorNotebookPath, dirname, joinNotebookPath, normalizeNotebookPath, notebookHrefFromPath, saveNotebookText, insertHtmlAtCaret } from "./insertMediaCommon.mjs";
import { fetchUrlAsText, looksLikeUrlOrAbsPath, notebookSourceFromPath } from "./insertMediaIO.mjs";

const EQUATION_FAMILY = "equation";
const DEFAULT_EQUATION_TEXT = "y = x";
const DEFAULT_EQUATION_CONTENT = `${DEFAULT_EQUATION_TEXT}\n`;
const EQUATION_INLINE_FORMATS = ["tex", "latex", "mathml"];

function normalizeEquationFormat(formatRaw = "") {
  const format = String(formatRaw || "").trim().toLowerCase();
  if (format === "latex" || format === "mathml") return format;
  return "tex";
}

function formatInlineEquationDisplay(equationText = "", formatRaw = "tex") {
  const format = normalizeEquationFormat(formatRaw);
  const safeText = escapeHtml(String(equationText || "").trim() || DEFAULT_EQUATION_TEXT);
  if (format === "latex") return `$$${safeText}$$`;
  if (format === "mathml") return safeText;
  return `\\(${safeText}\\)`;
}

function buildInlineEquationHtml(equationText = "", formatRaw = "tex") {
  const format = normalizeEquationFormat(formatRaw);
  const equation = String(equationText || "").trim() || DEFAULT_EQUATION_TEXT;
  const safeEquation = escapeHtml(equation);
  return `<span class="nv-inline-equation" data-nv-inline-equation-format="${format}" data-nv-inline-equation="${safeEquation}">${formatInlineEquationDisplay(equation, format)}</span>`;
}

export function button(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  Object.assign(b.style, { padding: "6px 10px", border: "1px solid #333", background: "#eee", cursor: "pointer" });
  return b;
}

export function renderGenericLink(root, familyLabel, exts = []) {
  const family = String(familyLabel || "Insert Media");
  const isEquationFamily = family.trim().toLowerCase() === EQUATION_FAMILY;
  const sourceExts = Array.from(new Set(exts || [])).map((e) => String(e).toLowerCase()).filter(Boolean);
  if (isEquationFamily) {
    EQUATION_INLINE_FORMATS.forEach((fmt) => sourceExts.push(fmt));
  }
  const extensions = Array.from(new Set(sourceExts)).sort((a, b) => a.localeCompare(b));
  const defaultExt = isEquationFamily
    ? (extensions.includes("tex") ? "tex" : (extensions[0] || "tex"))
    : (extensions[0] || "txt");
  const familyDir = `assets/${String(family).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "media"}`;
  const storageModeFieldset = `<fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Storage Mode</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-storage" value="referenced" checked> Referenced</label><label style="display:block;"><input type="radio" name="nv-storage" value="inline"> Inline</label></fieldset>`;
  const inlineContentField = isEquationFamily
    ? ""
    : `<label>Inline Content<textarea data-field="inlineContent" rows="5" style="display:block;width:100%;margin-top:4px;white-space:pre;">New ${escapeHtml(family)} item</textarea></label>`;
  const equationHint = isEquationFamily
    ? `<div style="font-size:11px;color:#555;">Inline inserts default equation ${escapeHtml(DEFAULT_EQUATION_TEXT)} using selected format.</div>`
    : "";

  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:280px;max-width:560px;"><div style="font-weight:600;">${escapeHtml(family)}</div><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Source</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-source" value="new" checked> New</label><label style="display:block;"><input type="radio" name="nv-source" value="existing"> Existing</label></fieldset>${storageModeFieldset}${equationHint}<div data-section="new" style="display:flex;flex-direction:column;gap:8px;"><div data-section="new-ref" style="display:flex;flex-direction:column;gap:8px;"><label>New Format<select data-field="format" style="display:block;width:100%;margin-top:4px;">${extensions.length ? extensions.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("") : `<option value="${escapeHtml(defaultExt)}">${escapeHtml(defaultExt)}</option>`}</select></label><label>New File Name<input data-field="newName" type="text" placeholder="file.${escapeHtml(defaultExt)}" style="display:block;width:100%;margin-top:4px;" /></label></div>${inlineContentField}</div><div data-section="existing" style="display:none;flex-direction:column;gap:8px;"><label>Existing Source (Notebook path or URL)<input data-field="existingSource" type="text" placeholder="path/to/file or https://..." style="display:block;width:100%;margin-top:4px;" /></label></div><div style="display:flex;gap:10px;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert</button></div><div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div></form>`;

  const form = root.querySelector("form");
  const sourceEls = () => Array.from(root.querySelectorAll('input[name="nv-source"]'));
  const storageEls = () => Array.from(root.querySelectorAll('input[name="nv-storage"]'));
  const newSection = root.querySelector('[data-section="new"]');
  const existingSection = root.querySelector('[data-section="existing"]');
  const newRefSection = root.querySelector('[data-section="new-ref"]');
  const formatEl = root.querySelector('[data-field="format"]');
  const newNameEl = root.querySelector('[data-field="newName"]');
  const inlineContentEl = root.querySelector('[data-field="inlineContent"]');
  const existingSourceEl = root.querySelector('[data-field="existingSource"]');
  const statusEl = root.querySelector('[data-field="status"]');
  const setStatus = (t) => { statusEl.textContent = String(t || ""); };
  const valueOf = (radios) => radios.find((r) => r.checked)?.value || "";

  const sync = () => {
    const src = valueOf(sourceEls());
    const storage = valueOf(storageEls());
    newSection.style.display = src === "new" ? "flex" : "none";
    existingSection.style.display = src === "existing" ? "flex" : "none";
    newRefSection.style.display = (src === "new" && (isEquationFamily || storage === "referenced")) ? "flex" : "none";
  };
  sourceEls().forEach((r) => r.addEventListener("change", sync));
  storageEls().forEach((r) => r.addEventListener("change", sync));
  sync();

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    setStatus("");
    try {
      const sourceMode = valueOf(sourceEls());
      const storageMode = valueOf(storageEls());
      const editorPath = getActiveEditorNotebookPath();
      const baseDir = dirname(editorPath);
      let html = "";

      if (sourceMode === "new") {
        if (isEquationFamily && storageMode === "inline") {
          const selectedFormat = normalizeEquationFormat(formatEl?.value || defaultExt);
          html = buildInlineEquationHtml(DEFAULT_EQUATION_TEXT, selectedFormat);
        } else if (storageMode === "inline") {
          html = `<pre style="white-space:pre-wrap;border:1px solid #ccc;padding:8px;">${escapeHtml(String(inlineContentEl.value || ""))}</pre>`;
        } else {
          const fmt = String(formatEl.value || defaultExt).trim().toLowerCase() || defaultExt;
          const rawName = String(newNameEl.value || `new-${Date.now()}.${fmt}`).trim();
          const fileName = rawName.includes(".") ? rawName : `${rawName}.${fmt}`;
          const notebookPath = normalizeNotebookPath(joinNotebookPath(joinNotebookPath(baseDir, familyDir), fileName));
          const fileBody = isEquationFamily ? DEFAULT_EQUATION_CONTENT : `New ${family}: ${fileName}\n`;
          await saveNotebookText(notebookPath, fileBody, "text/plain");
          const href = notebookSourceFromPath(notebookPath, editorPath);
          html = `<a href="${escapeHtml(href)}" data-nv-linked-path="${escapeHtml(notebookPath)}">${escapeHtml(fileName)}</a>`;
        }
      } else {
        const entered = String(existingSourceEl.value || "").trim();
        if (!entered) throw new Error("Enter an existing source.");
        if (storageMode === "inline") {
          const url = looksLikeUrlOrAbsPath(entered) ? entered : notebookHrefFromPath(normalizeNotebookPath(entered));
          const text = await fetchUrlAsText(url);
          if (isEquationFamily) {
            const selectedFormat = normalizeEquationFormat(formatEl?.value || defaultExt);
            const equation = String(text || "").trim() || DEFAULT_EQUATION_TEXT;
            html = buildInlineEquationHtml(equation, selectedFormat);
          } else {
            html = `<pre style="white-space:pre-wrap;border:1px solid #ccc;padding:8px;">${escapeHtml(text)}</pre>`;
          }
        } else if (looksLikeUrlOrAbsPath(entered)) {
          html = `<a href="${escapeHtml(entered)}">${escapeHtml(entered.split("/").pop() || entered)}</a>`;
        } else {
          const notebookPath = normalizeNotebookPath(entered);
          const href = notebookSourceFromPath(notebookPath, editorPath);
          const label = notebookPath.split("/").pop() || notebookPath;
          html = `<a href="${escapeHtml(href)}" data-nv-linked-path="${escapeHtml(notebookPath)}">${escapeHtml(label)}</a>`;
        }
      }

      insertHtmlAtCaret(html);
      setStatus("Inserted.");
    } catch (err) {
      console.warn("[insertMediaGeneric]", err);
      setStatus(err?.message || String(err));
    }
  });
}

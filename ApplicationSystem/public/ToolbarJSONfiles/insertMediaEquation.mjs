// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaEquation.mjs
// This module renders the shared Insert Equation media panel used by Insert Media and direct HTML equation toolbar actions.

import { createEquationExpressionEditor } from "/Equation/EquationExpressionEditor.mjs";
import { DEFAULT_INLINE_EQUATION, insertInlineEquationAtCaret, normalizeInlineEquationFormat } from "/Equation/HtmlInlineEquation.mjs";
import { escapeHtml, getActiveEditorNotebookPath, dirname, joinNotebookPath, normalizeNotebookPath, notebookHrefFromPath, saveNotebookText, insertHtmlAtCaret } from "./insertMediaCommon.mjs";
import { fetchUrlAsText, looksLikeUrlOrAbsPath, notebookSourceFromPath } from "./insertMediaIO.mjs";
import { openInsertMediaPanel } from "./insertMediaPanel.mjs";

const EQUATION_FORMATS = ["tex", "latex", "mathml"];
const DEFAULT_EQUATION_DIR = "assets/equations";

// === Form Helpers ===
function equationFormats(exts = []) {
  const seen = new Set();
  const formats = [];
  for (const raw of [...exts, ...EQUATION_FORMATS]) {
    const clean = String(raw || "").trim().toLowerCase();
    const format = clean === "mml" ? "mathml" : clean;
    if (!EQUATION_FORMATS.includes(format) || seen.has(format)) continue;
    seen.add(format);
    formats.push(format);
  }
  return formats.length ? formats : EQUATION_FORMATS;
}

function valueOf(radios) {
  return Array.from(radios || []).find((radio) => radio.checked)?.value || "";
}

function setVisible(el, visible, display = "block") {
  if (el) el.style.display = visible ? display : "none";
}

function linkHtmlForEquationSource(source, editorPath) {
  const entered = String(source || "").trim();
  if (!entered) throw new Error("Enter an equation source.");
  if (looksLikeUrlOrAbsPath(entered)) {
    const label = entered.split("/").pop() || entered;
    return `<a href="${escapeHtml(entered)}">${escapeHtml(label)}</a>`;
  }

  const notebookPath = normalizeNotebookPath(entered);
  if (!notebookPath) throw new Error("Enter a Notebook equation path.");
  const href = notebookSourceFromPath(notebookPath, editorPath);
  const label = notebookPath.split("/").pop() || notebookPath;
  return `<a href="${escapeHtml(href)}" data-nv-linked-path="${escapeHtml(notebookPath)}">${escapeHtml(label)}</a>`;
}

async function saveNewEquationFile({ format, fileName, equationText, editorPath }) {
  const baseDir = dirname(editorPath);
  const ext = normalizeInlineEquationFormat(format);
  const rawName = String(fileName || `equation-${Date.now()}.${ext}`).trim();
  const finalName = rawName.includes(".") ? rawName : `${rawName}.${ext}`;
  const path = joinNotebookPath(joinNotebookPath(baseDir, DEFAULT_EQUATION_DIR), finalName);
  const notebookPath = normalizeNotebookPath(path);
  await saveNotebookText(notebookPath, `${String(equationText || DEFAULT_INLINE_EQUATION).trim()}\n`, "text/plain");
  return notebookPath;
}

async function fetchExistingEquationText(source) {
  const entered = String(source || "").trim();
  if (!entered) throw new Error("Enter an equation source.");
  const url = looksLikeUrlOrAbsPath(entered) ? entered : notebookHrefFromPath(normalizeNotebookPath(entered));
  const text = await fetchUrlAsText(url);
  return String(text || "").trim() || DEFAULT_INLINE_EQUATION;
}

// === Renderer ===
export function renderEquation(root, exts = []) {
  if (!root) return;
  const formats = equationFormats(exts);
  const optionHtml = formats.map((format) => `<option value="${escapeHtml(format)}">${escapeHtml(format)}</option>`).join("");
  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:300px;max-width:620px;"><div style="font-weight:600;">Equation</div><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Source</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-equation-source" value="new" checked> New</label><label style="display:block;"><input type="radio" name="nv-equation-source" value="existing"> Existing</label></fieldset><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Storage Mode</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-equation-storage" value="inline" checked> Inline</label><label style="display:block;"><input type="radio" name="nv-equation-storage" value="referenced"> Referenced</label></fieldset><label data-field="format-wrap">Format<select data-field="format" style="display:block;width:100%;margin-top:4px;">${optionHtml}</select></label><div data-field="editor-host"></div><label data-field="new-name-wrap">New File Name<input data-field="newName" type="text" placeholder="equation.tex" style="display:block;width:100%;margin-top:4px;" /></label><div data-field="existing-wrap" style="display:none;"><label>Existing Source (Notebook path or URL)<input data-field="existingSource" type="text" placeholder="assets/equations/equation.tex" style="display:block;width:100%;margin-top:4px;" /></label></div><div style="display:flex;gap:10px;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert</button></div><div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div></form>`;

  const form = root.querySelector("form");
  const editorHost = root.querySelector('[data-field="editor-host"]');
  const formatWrap = root.querySelector('[data-field="format-wrap"]');
  const newNameWrap = root.querySelector('[data-field="new-name-wrap"]');
  const existingWrap = root.querySelector('[data-field="existing-wrap"]');
  const formatEl = root.querySelector('[data-field="format"]');
  const newNameEl = root.querySelector('[data-field="newName"]');
  const existingSourceEl = root.querySelector('[data-field="existingSource"]');
  const statusEl = root.querySelector('[data-field="status"]');
  const editor = createEquationExpressionEditor({
    currentExpressionText: DEFAULT_INLINE_EQUATION,
    dialect: "latex",
    placeholder: "x^2 + y^2 = z^2",
    multiline: true,
    collapsedTools: false,
  });
  editorHost.appendChild(editor.root);

  const setStatus = (message, isError = false) => {
    statusEl.style.color = isError ? "#b00" : "#126b21";
    statusEl.textContent = String(message || "");
  };
  const sourceEls = () => root.querySelectorAll('input[name="nv-equation-source"]');
  const storageEls = () => root.querySelectorAll('input[name="nv-equation-storage"]');
  const sync = () => {
    const source = valueOf(sourceEls());
    const storage = valueOf(storageEls());
    setVisible(editorHost, source === "new");
    setVisible(newNameWrap, source === "new" && storage === "referenced");
    setVisible(existingWrap, source === "existing");
    setVisible(formatWrap, source === "new" || storage === "inline");
  };
  sourceEls().forEach((radio) => radio.addEventListener("change", sync));
  storageEls().forEach((radio) => radio.addEventListener("change", sync));
  sync();

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    setStatus("");
    try {
      const source = valueOf(sourceEls());
      const storage = valueOf(storageEls());
      const format = normalizeInlineEquationFormat(formatEl?.value || "tex");
      const editorPath = getActiveEditorNotebookPath();

      if (storage === "inline") {
        const text = source === "existing"
          ? await fetchExistingEquationText(existingSourceEl?.value)
          : editor.getValue();
        if (!insertInlineEquationAtCaret(text, format)) throw new Error("No HTML editor is ready for equation insertion.");
      } else if (source === "new") {
        const notebookPath = await saveNewEquationFile({
          format,
          fileName: newNameEl?.value,
          equationText: editor.getValue(),
          editorPath,
        });
        insertHtmlAtCaret(linkHtmlForEquationSource(notebookPath, editorPath));
      } else {
        insertHtmlAtCaret(linkHtmlForEquationSource(existingSourceEl?.value, editorPath));
      }

      setStatus("Inserted.");
    } catch (err) {
      console.warn("[insertMediaEquation]", err);
      setStatus(err?.message || String(err), true);
    }
  });
}

export async function openEquationMediaPanel(exts = []) {
  window.HTMLWysiwygTools?.saveCurrentSelection?.();
  const panel = await openInsertMediaPanel("Insert Equation", "Equation");
  renderEquation(panel.mount, exts);
  return panel;
}

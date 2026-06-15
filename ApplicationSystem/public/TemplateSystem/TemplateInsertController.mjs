// Nodevision/ApplicationSystem/public/TemplateSystem/TemplateInsertController.mjs
// Insert -> Insert Template flow for code, graphical text, and HTML/WYSIWYG editors.

import { showTemplateFormDialog } from "./TemplateFormDialog.mjs";
import { showTemplatePicker } from "./TemplatePicker.mjs";

const HTML_EXTENSIONS = new Set(["html", "htm", "xhtml", "svg"]);

async function readTemplate(relativePath) {
  const response = await fetch(`/api/templates/read?path=${encodeURIComponent(relativePath)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Failed to read template (${response.status}).`);
  return data.template;
}

async function renderTemplate(templatePath, values) {
  const response = await fetch("/api/templates/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templatePath, values }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Failed to render template (${response.status}).`);
  return data;
}

function activeCellContains(node) {
  const cell = window.activeCell || window.__nvActivePanelElement || null;
  return Boolean(cell && node && cell.contains?.(node));
}

function getLiveMonacoEditor() {
  const editor = window.monacoEditor;
  const model = editor?.getModel?.();
  const dom = editor?.getDomNode?.();
  if (!editor || !model || !dom || !dom.isConnected) return null;
  return editor;
}

function getActiveWysiwyg() {
  const activeCell = window.activeCell || window.__nvActivePanelElement || null;
  const scoped = activeCell?.querySelector?.("#wysiwyg[contenteditable='true']");
  if (scoped) return scoped;
  return document.querySelector("#wysiwyg[contenteditable='true']");
}

function getActiveTextControl() {
  const activeCell = window.activeCell || window.__nvActivePanelElement || null;
  if (!activeCell?.querySelector) return null;
  const focused = document.activeElement;
  if (
    focused &&
    activeCell.contains(focused) &&
    (focused.matches?.("textarea") || focused.matches?.("input[type='text'], input:not([type])"))
  ) {
    return focused;
  }
  return activeCell.querySelector("textarea, input[type='text'], input:not([type])");
}

function chooseInsertionTarget() {
  const monacoEditor = getLiveMonacoEditor();
  const monacoDom = monacoEditor?.getDomNode?.();
  const wysiwyg = getActiveWysiwyg();
  const textControl = getActiveTextControl();

  if (monacoEditor && activeCellContains(monacoDom)) return { kind: "code", editor: monacoEditor };
  if (wysiwyg && activeCellContains(wysiwyg)) return { kind: "html", editor: wysiwyg };
  if (textControl && activeCellContains(textControl)) return { kind: "text", editor: textControl };
  if (monacoEditor && window.NodevisionState?.currentMode === "CodeEditing") return { kind: "code", editor: monacoEditor };
  if (textControl && window.NodevisionState?.currentMode === "GraphicalEditing") return { kind: "text", editor: textControl };
  if (wysiwyg && ["HTMLediting", "HTMLviewing", "EPUBediting"].includes(window.NodevisionState?.currentMode)) {
    return { kind: "html", editor: wysiwyg };
  }
  if (monacoEditor) return { kind: "code", editor: monacoEditor };
  if (wysiwyg) return { kind: "html", editor: wysiwyg };
  return null;
}

function insertIntoCodeEditor(editor, content) {
  const model = editor.getModel();
  if (!model) return false;
  const selections = editor.getSelections?.() || [];
  if (selections.length) {
    editor.executeEdits("insert-template", selections.map((selection) => ({
      range: selection,
      text: content,
      forceMoveMarkers: true,
    })));
  } else {
    const position = editor.getPosition?.();
    if (!position || !window.monaco?.Range) return false;
    editor.executeEdits("insert-template", [{
      range: new window.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
      text: content,
      forceMoveMarkers: true,
    }]);
  }
  editor.focus();
  return true;
}

function insertIntoHtmlEditor(wysiwyg, content, { asHtml }) {
  wysiwyg.focus();
  if (asHtml) {
    if (typeof window.HTMLWysiwygTools?.insertHTMLAtCaret === "function") {
      window.HTMLWysiwygTools.insertHTMLAtCaret(content);
    } else {
      document.execCommand("insertHTML", false, content);
    }
  } else {
    document.execCommand("insertText", false, content);
  }
  wysiwyg.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function insertIntoTextControl(input, content) {
  if (!input || typeof input.value !== "string") return false;
  input.focus();
  const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
  const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
  if (typeof input.setRangeText === "function") {
    input.setRangeText(content, start, end, "end");
  } else {
    input.value = input.value.slice(0, start) + content + input.value.slice(end);
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function isHtmlOutput(extension) {
  return HTML_EXTENSIONS.has(String(extension || "").replace(/^\./, "").toLowerCase());
}

function friendlyUnsupportedBinaryMessage() {
  return "This template looks like a binary file, so it cannot be inserted into the current editor. Use File -> Create from Template to copy it into the Notebook.";
}

export async function insertTemplateIntoActiveEditor() {
  try {
    const selected = await showTemplatePicker({
      title: "Insert Template",
      description: "Choose a template to insert into the active editor.",
      confirmText: "Continue",
    });
    if (!selected) return;

    const template = await readTemplate(selected.relativePath);
    let content = "";
    let outputExtension = template.outputExtension || template.extension || "txt";

    if (template.kind === "form") {
      const formResult = await showTemplateFormDialog(template, {
        title: template.displayName || "Template",
        description: "Fill in the fields to generate content for the active editor.",
        confirmText: "Insert",
      });
      if (!formResult) return;
      const rendered = await renderTemplate(template.relativePath, formResult.values || {});
      content = rendered.content || "";
      outputExtension = rendered.outputExtension || outputExtension;
    } else {
      if (template.isBinary) {
        alert(friendlyUnsupportedBinaryMessage());
        return;
      }
      content = template.content || "";
    }

    const target = chooseInsertionTarget();
    if (!target) {
      alert("Open a code, graphical text, or HTML editor before inserting a template.");
      return;
    }

    let inserted = false;
    if (target.kind === "code") {
      inserted = insertIntoCodeEditor(target.editor, content);
    } else if (target.kind === "text") {
      inserted = insertIntoTextControl(target.editor, content);
    } else {
      inserted = insertIntoHtmlEditor(target.editor, content, { asHtml: isHtmlOutput(outputExtension) });
    }

    if (!inserted) {
      alert("The active editor does not support inserting this template.");
    }
  } catch (err) {
    console.error("Insert template failed:", err);
    alert(`Insert template failed: ${err?.message || err}`);
  }
}

export default insertTemplateIntoActiveEditor;


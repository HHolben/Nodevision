// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/RegisterHTMLFallbackHotkeys.mjs
// This module implements register HTMLFallback Hotkeys behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { setStatus } from "/StatusBar.mjs";
import { markHtmlEditorDirty } from "./EnsureHTMLLayoutStyles.mjs";
import { renderInlineEquations } from "/Equation/HtmlInlineEquation.mjs";

// Register HTMLFallback Hotkeys operations.
export
// --------------------------------------------------
// Fallback Hotkeys (self-contained)
// --------------------------------------------------
function registerHTMLFallbackHotkeys(wysiwyg, filePath, rootElem) {
  let insertTabCallback = null;
  let insertTabCallbackPromise = null;
  const ensureInsertTabCallback = () => {
    if (insertTabCallback) return Promise.resolve(insertTabCallback);
    if (!insertTabCallbackPromise) {
      insertTabCallbackPromise = import("/ToolbarCallbacks/insert/insertTab.mjs").then(mod => {
        insertTabCallback = typeof mod?.default === "function" ? mod.default : null;
        return insertTabCallback;
      }).catch(err => {
        console.warn("Failed to load insertTab callback:", err);
        insertTabCallbackPromise = null;
        insertTabCallback = null;
        return null;
      });
    }
    return insertTabCallbackPromise;
  };
  const handlers = {
    "Control+s": e => {
      e.preventDefault();
      const context = wysiwyg.__nvHtmlEditorContext;
      context?.save().catch(error => {
        console.error("HTML save failed:", error);
        setStatus("Save failed", error.message);
      });
      console.log("🔧 Fallback hotkey: Save");
    },
    "Control+b": e => {
      e.preventDefault();
      document.execCommand("bold");
      console.log("🔧 Fallback hotkey: Bold");
    },
    "Control+i": e => {
      e.preventDefault();
      document.execCommand("italic");
      console.log("🔧 Fallback hotkey: Italic");
    },
    "Control+u": e => {
      e.preventDefault();
      document.execCommand("underline");
      console.log("🔧 Fallback hotkey: Underline");
    },
    "Control+z": e => {
      e.preventDefault();
      runUndoCommandWithProgrammaticFallback(wysiwyg, "undo", filePath);
      console.log("🔧 Fallback hotkey: Undo");
    },
    "Control+Shift+z": e => {
      e.preventDefault();
      runUndoCommandWithProgrammaticFallback(wysiwyg, "redo", filePath);
      console.log("🔧 Fallback hotkey: Redo");
    },
    // Match Insert → Insert Text → Tab behavior.
    // In the HTML graphical editor, Tab should insert a tab character (not change focus).
    "tab": e => {
      if (!wysiwyg?.contains?.(e.target)) return;
      e.preventDefault();
      void ensureInsertTabCallback().then(cb => {
        if (cb) cb();else document.execCommand("insertText", false, "\t");
      });
    },
    "Shift+tab": e => {
      if (!wysiwyg?.contains?.(e.target)) return;
      e.preventDefault();
      void ensureInsertTabCallback().then(cb => {
        if (cb) cb();else document.execCommand("insertText", false, "\t");
      });
    }
  };
  const onKeyDown = e => {
    const key = (e.ctrlKey ? "Control+" : "") + (e.shiftKey ? "Shift+" : "") + e.key.toLowerCase();
    if (handlers[key]) {
      handlers[key](e);
    }
  };
  rootElem.addEventListener("keydown", onKeyDown);
  console.log("🔧 HTML Fallback Hotkeys Loaded");
  return () => rootElem.removeEventListener("keydown", onKeyDown);
}

export function runUndoCommandWithProgrammaticFallback(wysiwyg, command, filePath = "") {
  if (wysiwyg.__nvProgrammaticHistory?.owned) return wysiwyg.__nvProgrammaticHistory[command === "redo" ? "redo" : "undo"]();
  if (wysiwyg.__nvPropertiesUndoBlocked) {
    setStatus("Undo paused", "Use Properties Undo before typing again, or save and reopen this document.");
    return false;
  }
  const direction = command === "redo" ? "redo" : "undo";
  const history = wysiwyg?.__nvProgrammaticHistory || null;
  const beforeHtml = String(wysiwyg?.innerHTML || "");
  let nativeChanged = false;
  try {
    wysiwyg?.focus?.();
    document.execCommand(direction);
    nativeChanged = String(wysiwyg?.innerHTML || "") !== beforeHtml;
  } catch (err) {
    console.warn("HTML editor " + direction + " command failed:", err);
  }
  if (nativeChanged) {
    if (direction === "undo") history?.noteNativeUndo?.(beforeHtml);else history?.noteNativeRedo?.(beforeHtml);
    markHtmlEditorDirty(wysiwyg, filePath);
    return true;
  }
  return direction === "undo" ? Boolean(history?.undo?.()) : Boolean(history?.redo?.());
}

export const HTML_VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

export const HTML_RAW_TEXT_TAGS = new Set(["script", "style", "pre", "textarea"]);

export async function installLineNumberedPoetryTools(wysiwyg) {
  if (!wysiwyg) return () => {};
  try {
    const poetry = await import("/ToolbarCallbacks/insert/insertLineNumberedPoetry.mjs");
    if (typeof poetry.installPoemEditingBehavior === "function") {
      return poetry.installPoemEditingBehavior(wysiwyg) || (() => {});
    }
  } catch (err) {
    console.warn("Failed to initialize line numbered poetry tools:", err);
  }
  return () => {};
}

export function renderInlineEquationsForEditor(wysiwyg) {
  if (!wysiwyg) return;
  renderInlineEquations(wysiwyg).catch(err => {
    console.warn("Failed to render inline equations in HTML editor:", err);
  });
}

export function normalizeEditorSavePath(pathValue) {
  return String(pathValue || "").trim().split(String.fromCharCode(92)).join("/").split(/[?#]/)[0].replace(/^\/+/, "").replace(/^Notebook\//i, "");
}

export function sameEditorSavePath(a, b) {
  return normalizeEditorSavePath(a) === normalizeEditorSavePath(b);
}

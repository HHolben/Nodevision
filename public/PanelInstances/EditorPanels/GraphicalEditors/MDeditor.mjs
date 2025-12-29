// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/MDeditor.mjs
// This file populates the panel with the Markdown editor.

import { updateToolbarState } from "/panels/createToolbar.mjs";

// --------------------------------------------------
// Fallback Hotkeys (self-contained)
// --------------------------------------------------
function registerMDFallbackHotkeys(textarea, filePath) {
  const surroundSelection = (before, after = before) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);

    textarea.setRangeText(
      `${before}${selected}${after}`,
      start,
      end,
      "end"
    );
    textarea.focus();
  };

  const handlers = {
    "Control+s": (e) => {
      e.preventDefault();
      if (window.saveMDFile) {
        window.saveMDFile(filePath);
      }
      console.log("🔧 Fallback hotkey: Save");
    },

    "Control+b": (e) => {
      e.preventDefault();
      surroundSelection("**");
      console.log("🔧 Fallback hotkey: Bold");
    },

    "Control+i": (e) => {
      e.preventDefault();
      surroundSelection("*");
      console.log("🔧 Fallback hotkey: Italic");
    },

    "Control+u": (e) => {
      e.preventDefault();
      surroundSelection("<u>", "</u>");
      console.log("🔧 Fallback hotkey: Underline");
    },

    "Control+z": (e) => {
      e.preventDefault();
      document.execCommand("undo");
      console.log("🔧 Fallback hotkey: Undo");
    },

    "Control+Shift+z": (e) => {
      e.preventDefault();
      document.execCommand("redo");
      console.log("🔧 Fallback hotkey: Redo");
    }
  };

  document.addEventListener("keydown", (e) => {
    const key =
      (e.ctrlKey ? "Control+" : "") +
      (e.shiftKey ? "Shift+" : "") +
      e.key;

    if (handlers[key]) {
      handlers[key](e);
    }
  });

  console.log("🔧 Markdown Fallback Hotkeys Loaded");
}

// --------------------------------------------------
// Main Markdown Editor
// --------------------------------------------------

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  // Set mode
  window.NodevisionState.currentMode = "MDediting";
  updateToolbarState({ currentMode: "MDediting" });

  // Root container
  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  container.appendChild(wrapper);

  // Markdown textarea
  const textarea = document.createElement("textarea");
  textarea.id = "markdown-editor";
  textarea.style.flex = "1";
  textarea.style.width = "100%";
  textarea.style.resize = "none";
  textarea.style.padding = "12px";
  textarea.style.fontFamily = "monospace";
  textarea.style.fontSize = "14px";
  textarea.style.lineHeight = "1.5";
  textarea.spellcheck = true;
  wrapper.appendChild(textarea);

  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);

    const mdText = await res.text();
    textarea.value = mdText;

    // Expose editor helpers
    window.getEditorMarkdown = () => textarea.value;

    window.setEditorMarkdown = (md) => {
      textarea.value = md || "";
    };

    window.saveMDFile = async (path) => {
      const content = window.getEditorMarkdown();
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path || filePath, content }),
      });
      console.log("Saved Markdown file:", path || filePath);
    };

  } catch (err) {
    wrapper.innerHTML =
      `<div style="color:red;padding:12px">Failed to load file: ${err.message}</div>`;
    console.error(err);
  }

  // --------------------------------------------------
  // Enable fallback hotkeys
  // --------------------------------------------------
  registerMDFallbackHotkeys(textarea, filePath);
}

// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs
// This file populates the panel with the HTML editor.

import { updateToolbarState } from "/panels/createToolbar.mjs";

// --------------------------------------------------
// Fallback Hotkeys (self-contained)
// --------------------------------------------------
function registerHTMLFallbackHotkeys(wysiwyg, filePath) {
  const handlers = {
    "Control+s": (e) => {
      e.preventDefault();
      if (window.saveWYSIWYGFile) {
        window.saveWYSIWYGFile(filePath);
      }
      console.log("🔧 Fallback hotkey: Save");
    },

    "Control+b": (e) => {
      e.preventDefault();
      document.execCommand("bold");
      console.log("🔧 Fallback hotkey: Bold");
    },

    "Control+i": (e) => {
      e.preventDefault();
      document.execCommand("italic");
      console.log("🔧 Fallback hotkey: Italic");
    },

    "Control+u": (e) => {
      e.preventDefault();
      document.execCommand("underline");
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

  console.log("🔧 HTML Fallback Hotkeys Loaded");
}

// --------------------------------------------------
// Main HTML Editor
// --------------------------------------------------

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  // Set mode
  window.NodevisionState.currentMode = "HTMLediting";
  updateToolbarState({ currentMode: "HTMLediting" });

  // Root container
  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  container.appendChild(wrapper);

  // WYSIWYG editable area
  const wysiwyg = document.createElement("div");
  wysiwyg.id = "wysiwyg";
  wysiwyg.contentEditable = "true";
  wysiwyg.style.flex = "1";
  wysiwyg.style.overflow = "auto";
  wysiwyg.style.padding = "12px";
  wrapper.appendChild(wysiwyg);

  // Hidden script container
  const hidden = document.createElement("div");
  hidden.id = "hidden-elements";
  hidden.style.display = "none";
  wrapper.appendChild(hidden);

  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);
    const htmlText = await res.text();

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    // Clone <head>
    const headClone = document.createElement("div");
    for (const el of doc.head.children) {
      if (el.tagName === "SCRIPT") {
        const placeholder = document.createElement("div");
        placeholder.dataset.script = el.textContent;
        hidden.appendChild(placeholder);
      } else {
        headClone.appendChild(el.cloneNode(true));
      }
    }
    wrapper.prepend(headClone);

    // Clone <body>
    for (const child of doc.body.children) {
      if (child.tagName === "SCRIPT") {
        const placeholder = document.createElement("div");
        placeholder.dataset.script = child.textContent;
        hidden.appendChild(placeholder);
      } else {
        wysiwyg.appendChild(child.cloneNode(true));
      }
    }

    // Saving function
    window.getEditorHTML = () => {
      const headContent = Array.from(headClone.children)
        .map(el => el.outerHTML)
        .join("\n");

      const bodyContent = wysiwyg.innerHTML;

      const scripts = Array.from(hidden.children)
        .map(el => `<script>${el.dataset.script}</script>`)
        .join("\n");

      return `<!DOCTYPE html><html><head>${headContent}</head><body>${bodyContent}${scripts}</body></html>`;
    };

    window.setEditorHTML = (html) => {
      const doc = parser.parseFromString(html, "text/html");
      wysiwyg.innerHTML = "";
      hidden.innerHTML = "";

      for (const el of doc.body.children) {
        if (el.tagName === "SCRIPT") {
          const placeholder = document.createElement("div");
          placeholder.dataset.script = el.textContent;
          hidden.appendChild(placeholder);
        } else {
          wysiwyg.appendChild(el.cloneNode(true));
        }
      }
    };

    window.saveWYSIWYGFile = async (path) => {
      const content = window.getEditorHTML();
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path || filePath, content }),
      });
      console.log("Saved WYSIWYG file:", path || filePath);
    };

  } catch (err) {
    wrapper.innerHTML =
      `<div style="color:red;padding:12px">Failed to load file: ${err.message}</div>`;
    console.error(err);
  }

  // --------------------------------------------------
  // Enable fallback hotkeys
  // --------------------------------------------------
  registerHTMLFallbackHotkeys(wysiwyg, filePath);
}

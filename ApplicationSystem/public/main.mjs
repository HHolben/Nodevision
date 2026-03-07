// Nodevision/public/main.mjs
// Purpose: Initializes workspace, loads DefaultLayout.json, and renders panels with dividers.

import "/ToolbarCallbacks/file/saveFile.mjs"; // registers saveFile/saveCurrentFile globally
import "/KeyboardShortcuts/ShortcutSave.js"; // installs Ctrl+S shortcut handler
import { createToolbar } from './panels/createToolbar.mjs';
import { ensureWorkspace, loadDefaultLayout, renderLayout } from "./panels/workspace.mjs";
import { initStatusBar } from "./StatusBar.mjs";


//Initialize the status bar: 
initStatusBar();

async function initNodevision() {
  try {
    await createToolbar("#global-toolbar");

    const workspace = ensureWorkspace();
    console.log("Workspace initialized:", workspace);

    const layout = await loadDefaultLayout();
    console.log("Fetched layout file:", layout);

    const root = layout?.workspace || layout;
    if (root?.children?.length > 0) {
      console.log("Loaded declarative layout:", root);
      renderLayout(root, workspace);
    } else {
      console.warn("No valid DefaultLayout.json found, using fallback layout.");
    }

    addDividers();
  } catch (err) {
    console.error("Error during initialization:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNodevision);
} else {
  initNodevision();
}

/**
 * Adds horizontal and vertical divider styling between layout cells.
 */
function addDividers() {
  const style = document.createElement("style");
  style.textContent = `
    #workspace {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    /* General layout styling */
    .layout-row {
      display: flex;
      flex-direction: row;
      flex: 1;
      border-bottom: 3px solid #333; /* Horizontal divider */
    }

    .layout-column {
      display: flex;
      flex-direction: column;
      flex: 1;
      border-right: 3px solid #333; /* Vertical divider */
    }

    .layout-cell {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #444;
      background-color: #1e1e1e;
      color: white;
      font-family: sans-serif;
      overflow: auto;
    }

    .divider {
      width: 6px;
      background: #555;
      cursor: col-resize;
      flex: 0 0 auto;
      z-index: 10;
    }

    .divider:hover {
      background: #777;
    }

    /* Last child should not draw a divider on its outer edge */
    .layout-row > .layout-cell:last-child {
      border-right: none;
    }

    .layout-column > .layout-cell:last-child {
      border-bottom: none;
    }
  `;
  document.head.appendChild(style);
}

// Nodevision/public/main.mjs
// Purpose: Initializes workspace, loads DefaultLayout.json, and renders panels with dividers.
import { createToolbar } from './panels/createToolbar.mjs';
import { ensureWorkspace, loadDefaultLayout, renderLayout } from "./panels/workspace.mjs";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    
    // 2. ADD THIS FUNCTION CALL to execute the toolbar creation
    // Assuming your HTML has an element with id="global-toolbar"
    createToolbar("#global-toolbar"); 

  
    // Ensure the workspace container exists or create it
    const workspace = ensureWorkspace();
    console.log("Workspace initialized:", workspace);

    // Attempt to load DefaultLayout.json from /layouts
    const layout = await loadDefaultLayout();
    console.log("Fetched layout file:", layout);

    if (layout && layout.children && layout.children.length > 0) {
      console.log("Loaded declarative layout:", layout);
      renderLayout(layout, workspace);
    } else {
      console.warn("No valid DefaultLayout.json found, using fallback layout.");
    }

    // --- Apply divider styles (for visual separation) ---
    addDividers();

  } catch (err) {
    console.error("Error during initialization:", err);
  }
});

/**
 * Adds horizontal and vertical divider styling between layout cells.
 */
function addDividers() {
  const style = document.createElement("style");
  style.textContent = `
    #workspace {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
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

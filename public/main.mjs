// Nodevision/public/main.mjs
// Oversees toolbar + layout loading + workspace setup

import { createToolbar } from './panels/createToolbar.mjs';
import { makeGridResizable } from './panels/gridResizer.mjs';
import { makeRowsResizable } from './panels/rowResizer.mjs';
import { ensureWorkspace, createCell } from './panels/workspace.mjs';

document.addEventListener("DOMContentLoaded", async () => {
  createToolbar("#global-toolbar");

  const workspace = ensureWorkspace();

  const layout = await loadDefaultLayout();

  console.log("Fetched layout file:", layout);

let root = null;

if (layout?.workspace) root = layout.workspace;
else if (layout?.layout) root = layout.layout;
else if (layout?.type) root = layout;

if (root) {
  console.log("Loaded declarative layout:", root);
  applyLayout(workspace, root);
} else {
  console.warn("No valid DefaultLayout.json found, using fallback layout.");
}


  makeGridResizable(workspace, { minSize: 50 });
  makeRowsResizable(workspace, { minHeight: 50 });
});

async function loadDefaultLayout() {
  try {
    const response = await fetch("/UserSettings/DefaultLayout.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error("Failed to load DefaultLayout.json:", err);
    return null;
  }
}


/**
 * Applies a grid-based layout from DefaultLayout.json
 */
function applyLayout(workspace, layout) {
  if (!layout || layout.type !== "grid") return;

  workspace.style.display = "grid";
  workspace.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;
  workspace.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
  workspace.style.gap = "8px";
  workspace.innerHTML = ""; // clear any existing content

  layout.cells.forEach(cell => {
    const div = document.createElement("div");
    div.className = "panel-cell";
    div.textContent = cell.id || "Untitled Panel";

    // basic styling
    Object.assign(div.style, {
      border: "1px solid #aaa",
      background: "#fafafa",
      padding: "8px",
      overflow: "auto"
    });

    // place into correct grid position
    if (cell.position) {
      const [col, row] = cell.position.split(",").map(Number);
      div.style.gridColumn = col + 1;
      div.style.gridRow = row + 1;
    }

    workspace.appendChild(div);
  });
}


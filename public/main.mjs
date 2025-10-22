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

function applyLayout(parent, node) {
  if (!node) return;

  if (node.type === "workspace" || node.type === "vertical") {
    const container = document.createElement("div");
    Object.assign(container.style, {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });
    parent.appendChild(container);
    node.children?.forEach(child => applyLayout(container, child));
  }

  else if (node.type === "row") {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      flexDirection: "row",
      gap: "8px",
      borderBottom: "2px solid #ccc",
      overflow: "auto"
    });
    parent.appendChild(row);
    node.children?.forEach(child => applyLayout(row, child));
  }

  else if (node.type === "cell") {
    const cell = createCell(parent);
    cell.dataset.id = node.id;
    cell.textContent = node.content || "(empty)";
  }
}

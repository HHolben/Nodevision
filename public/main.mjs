// Nodevision/public/main.mjs
// Oversees toolbar + layout loading + workspace setup + visual dividers

import { createToolbar } from './panels/createToolbar.mjs';
import { makeGridResizable } from './panels/gridResizer.mjs';
import { makeRowsResizable } from './panels/rowResizer.mjs';
import { ensureWorkspace, loadDefaultLayout } from './panels/workspace.mjs';

document.addEventListener("DOMContentLoaded", async () => {
  // --- Toolbar setup ---
  createToolbar("#global-toolbar");

  // --- Workspace setup ---
  const workspace = ensureWorkspace();

  // --- Load DefaultLayout.json ---
  const layout = await loadDefaultLayout();
  console.log("Fetched layout file:", layout);

  let root = null;
  if (layout?.workspace) root = layout.workspace;
  else if (layout?.layout) root = layout.layout;
  else if (layout?.type) root = layout;

  if (root) {
    console.log("Loaded declarative layout:", root);
    renderFlexLayout(workspace, root);
  } else {
    console.warn("No valid DefaultLayout.json found, using fallback layout.");
  }

  // --- Enable resizers ---
  makeGridResizable(workspace, { minSize: 120 });
  makeRowsResizable(workspace, { minHeight: 100 });

  // --- Add divider styling ---
  addDividers();
});

/**
 * Handles row/column-based layouts with visible divider bars
 */
function renderFlexLayout(container, layout) {
  container.innerHTML = "";
  container.className = layout.type === "row" ? "layout-row" : "layout-column";

  layout.children.forEach((child, index) => {
    // --- Create the panel cell ---
    const cell = document.createElement("div");
    cell.className = "panel-cell";
    cell.dataset.id = child.id || `panel-${index}`;
    cell.textContent = child.content || child.id || "Untitled Panel";
    Object.assign(cell.style, {
      flex: "1 1 0",
      border: "1px solid #444",
      background: "#1e1e1e",
      color: "#fff",
      padding: "6px",
      overflow: "auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "4px",
    });
    container.appendChild(cell);

    // --- Add divider except after last cell ---
    if (index < layout.children.length - 1) {
      const divider = document.createElement("div");
      divider.className =
        layout.type === "row" ? "vertical-divider" : "horizontal-divider";
      container.appendChild(divider);

      // --- Attach drag resizing behavior ---
      attachDividerDrag(divider, cell, layout.type);
    }
  });
}

/**
 * Allows divider dragging between two flex items
 */
function attachDividerDrag(divider, leftCell, direction) {
  let nextCell = null;

  divider.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const parent = divider.parentElement;
    const children = Array.from(parent.children);
    const leftIndex = children.indexOf(leftCell);
    nextCell = children[leftIndex + 2]; // skip divider itself
    if (!nextCell) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeftRect = leftCell.getBoundingClientRect();
    const startRightRect = nextCell.getBoundingClientRect();

    function onMouseMove(e) {
      if (direction === "row") {
        const dx = e.clientX - startX;
        const totalWidth = startLeftRect.width + startRightRect.width;
        const leftPercent = ((startLeftRect.width + dx) / totalWidth) * 100;
        const rightPercent = ((startRightRect.width - dx) / totalWidth) * 100;
        leftCell.style.flex = `0 0 ${leftPercent}%`;
        nextCell.style.flex = `0 0 ${rightPercent}%`;
      } else {
        const dy = e.clientY - startY;
        const totalHeight = startLeftRect.height + startRightRect.height;
        const topPercent = ((startLeftRect.height + dy) / totalHeight) * 100;
        const bottomPercent = ((startRightRect.height - dy) / totalHeight) * 100;
        leftCell.style.flex = `0 0 ${topPercent}%`;
        nextCell.style.flex = `0 0 ${bottomPercent}%`;
      }
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

/**
 * Adds styling for dividers and layout cells
 */
function addDividers() {
  const style = document.createElement("style");
  style.textContent = `
    #workspace {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 40px);
      width: 100vw;
      overflow: hidden;
      background-color: #121212;
    }

    .layout-row {
      display: flex;
      flex-direction: row;
      height: 100%;
      width: 100%;
    }

    .layout-column {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    .panel-cell {
      flex: 1;
      transition: flex 0.2s ease;
      min-width: 80px;
      min-height: 60px;
    }

    .vertical-divider {
      width: 6px;
      background-color: #333;
      cursor: col-resize;
      flex-shrink: 0;
      user-select: none;
      transition: background 0.2s;
    }

    .horizontal-divider {
      height: 6px;
      background-color: #333;
      cursor: row-resize;
      flex-shrink: 0;
      user-select: none;
      transition: background 0.2s;
    }

    .vertical-divider:hover,
    .horizontal-divider:hover {
      background-color: #666;
    }
  `;
  document.head.appendChild(style);
}

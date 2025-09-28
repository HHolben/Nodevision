// Nodevision/public/panelManager.mjs
// Manage creation, docking, and floating panels

import { makeResizableAndDraggable, bringToFront } from './resizeAndDrag.js';

let panelCounter = 0;

// Keep a reference to all dockable cells
export const dockCells = Array.from(document.querySelectorAll('.cell'));

/**
 * Create a new panel
 */
export function createPanel(templateName, options = {}) {
  const { dockCellId, floating = true } = options;

  const panel = document.createElement('div');
  panel.classList.add('panel');
  panel.dataset.panelId = `panel-${panelCounter++}`;

  // Drag bar
  const dragBar = document.createElement('div');
  dragBar.classList.add('drag-bar');
  dragBar.textContent = templateName;
  panel.appendChild(dragBar);

  // Content
  const content = document.createElement('div');
  content.classList.add('panel-content');
  content.style.flex = '1';
  content.style.overflow = 'auto';
  content.innerHTML = `<p>${templateName} content here</p>`;
  panel.appendChild(content);

  // Resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.classList.add('resize-handle');
  panel.appendChild(resizeHandle);

  // Attach to overlay if floating
  if (floating || !dockCellId) {
    panel.classList.add('floating');
    const overlay = document.getElementById('overlay') || createOverlayLayer();
    overlay.appendChild(panel);
    makeResizableAndDraggable(panel, dockCells); // pass dockCells
  } else {
    const cell = document.getElementById(dockCellId);
    if (!cell) {
      console.warn(`Dock cell "${dockCellId}" not found, using floating mode`);
      panel.classList.add('floating');
      const overlay = document.getElementById('overlay') || createOverlayLayer();
      overlay.appendChild(panel);
      makeResizableAndDraggable(panel, dockCells);
    } else {
      panel.classList.add('docked');
      cell.appendChild(panel);
      makeResizableAndDraggable(panel, dockCells);
      panel.style.top = '0';
      panel.style.left = '0';
      panel.style.width = '100%';
      panel.style.height = '100%';
    }
  }

  bringToFront(panel);
  return panel;
}

function createOverlayLayer() {
  const overlay = document.createElement('div');
  overlay.id = 'overlay';
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Dock a panel into a cell
 */
export function dockPanel(panel, cell) {
  panel.classList.remove('floating');
  panel.classList.add('docked');
  cell.appendChild(panel);
  panel.style.top = '0';
  panel.style.left = '0';
  panel.style.width = '100%';
  panel.style.height = '100%';
}

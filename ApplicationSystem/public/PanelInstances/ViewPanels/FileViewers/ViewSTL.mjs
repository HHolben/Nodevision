// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSTL.mjs
// This file defines browser-side View STL logic for the Nodevision UI. It renders interface components and handles user interactions.

import { STLViewer } from "./ViewSTL/STLViewer.mjs";

const viewers = new WeakMap(); // one viewer per container

export function renderSTL(filePath, container, serverBase) {
  let viewer = viewers.get(container);

  if (!viewer) {
    viewer = new STLViewer(container);
    viewers.set(container, viewer);
  }

  viewer.loadSTL(filePath, serverBase);
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    renderSTL(filename, viewPanel, serverBase);
  } catch (err) {
    console.error('[ViewSTL] Error:', err);
    viewPanel.innerHTML = `<p style="color:red;">Error loading STL file.</p>`;
  }
}

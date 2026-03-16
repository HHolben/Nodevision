// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewIO.mjs
// This file defines browser-side View IO logic for the Nodevision UI. It renders interface components and handles user interactions.

import * as JSZip from "/lib/jszip/jszip.min.js";
import { IOViewer } from "./ViewIO/IOViewer.mjs";

const zip = await JSZip.loadAsync(buffer);

const viewers = new WeakMap();

export function renderIO(filePath, container, serverBase) {
  let viewer = viewers.get(container);
  if (!viewer) {
    viewer = new IOViewer(container);
    viewers.set(container, viewer);
  }
  viewer.loadIO(filePath, serverBase);
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    renderIO(filename, viewPanel, serverBase);
  } catch (err) {
    console.error('[ViewIO] Error:', err);
    viewPanel.innerHTML =
      `<p style="color:red;">Error loading .io file.</p>`;
  }
}

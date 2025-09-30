// Nodevision/public/main.mjs
//This script oversees the implemntation of the toolbar

import { createToolbar } from './panels/createToolbar.mjs';
import { makeGridResizable } from './panels/gridResizer.mjs';
import { makeRowsResizable } from './panels/rowResizer.mjs';

document.addEventListener("DOMContentLoaded", () => {
  createToolbar("#global-toolbar");

  const workspace = document.getElementById("workspace");
  if (workspace) {
    makeGridResizable(workspace, { minSize: 50 });
    makeRowsResizable(workspace, { minHeight: 50 });
  }
});


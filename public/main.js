// public/main.js

import { createToolbar } from './createToolbar.js';
import { bringToFront, toggleFullscreen, closeBox, runScript } from './boxManipulation.js';
import { makeResizableAndDraggable } from './resizeAndDrag.js';

document.addEventListener('DOMContentLoaded', function() {
  // ==== Split‐pane resizing ====
  const divider = document.getElementById('divider');
  const containerLeft = divider.previousElementSibling;
  const containerRight = divider.nextElementSibling;
  const contentFrame = document.getElementById('content-frame');
  let isResizing = false;

  divider.addEventListener('mousedown', function (e) {
    isResizing = true;
    contentFrame.style.pointerEvents = 'none';
  });

  document.addEventListener('mousemove', function (e) {
    if (!isResizing) return;
    const offsetRight = document.body.offsetWidth - (e.clientX - document.body.offsetLeft);
    containerLeft.style.width = `calc(100% - ${offsetRight}px)`;
    containerRight.style.width = `${offsetRight}px`;
    contentFrame.style.width = `${containerRight.offsetWidth}px`;
  });

  document.addEventListener('mouseup', function () {
    isResizing = false;
    contentFrame.style.pointerEvents = 'auto';
  });

  // ==== Global button delegation ====
  document.body.addEventListener('click', function(event) {
    const btn = event.target;
    const boxEl = btn.closest('.box');

    // Fullscreen toggle
    if (btn.matches('.fullscreen-btn') && boxEl) {
      toggleFullscreen(boxEl);
      return;
    }

    // Close box
    if (btn.matches('.close-btn') && boxEl) {
      closeBox(boxEl);
      return;
    }

    // Run script
    if (btn.matches('.run-script-btn') && boxEl) {
      const scriptName = boxEl.dataset.script;
      if (scriptName) {
        runScript(scriptName);
      } else {
        console.error('No script name found on box element.');
      }
    }
  });

  // ==== Initialize toolbar ====
  createToolbar('.toolbar');

});

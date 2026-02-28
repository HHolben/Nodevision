// Nodevision/public/panels/panelDrag.mjs
//This module is for floating panel logic.

import { bringToFront } from "./utils.mjs";

export function attachDragEvents(panel, header) {
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;

  header.addEventListener("mousedown", (e) => {
    if (panel.classList.contains("docked") || panel.classList.contains("maximized")) return;

    isDragging = true;
    offsetX = e.clientX - panel.offsetLeft;
    offsetY = e.clientY - panel.offsetTop;
    bringToFront(panel);
    document.body.style.userSelect = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    panel.style.left = e.clientX - offsetX + "px";
    panel.style.top = e.clientY - offsetY + "px";
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
    document.body.style.userSelect = "";
  });
}

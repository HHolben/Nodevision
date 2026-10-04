// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/AppendEditorHandlesToItem.mjs
// This module implements append Editor Handles To Item behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { markEditorOnly } from "./RemoveTextStylesFromWysiwygSelection.mjs";
import { presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { createAddEventListenerPointerdownHandler } from "./CreateCanvasResizeMoveHandler.mjs";

// Append Editor Handles To Item operations.
export function appendEditorHandlesToItem(item) {
  if (!item.querySelector(".nv-rotate-handle")) {
    const rotate = document.createElement("div");
    rotate.className = "nv-rotate-handle";
    rotate.title = "Rotate";
    markEditorOnly(rotate);
    item.appendChild(rotate);
  }
  if (item.querySelectorAll(".nv-resize-handle").length === 0) {
    const resizeDirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
    resizeDirs.forEach(dir => {
      const h = document.createElement("div");
      h.className = "nv-resize-handle";
      h.dataset.dir = dir;
      markEditorOnly(h);
      item.appendChild(h);
    });
  }
  if (item.querySelectorAll(".nv-edge-grab").length === 0) {
    ["n", "s", "e", "w"].forEach(edge => {
      const edgeGrab = document.createElement("div");
      edgeGrab.className = "nv-edge-grab";
      edgeGrab.dataset.edge = edge;
      markEditorOnly(edgeGrab);
      item.appendChild(edgeGrab);
    });
  }
}

export function makeCanvasItemInteractive(item, canvas) {
  if (item.dataset.nvInteractive === "true") return;
  presentHtmlAttribute(item, "data-nv-interactive", "true");
  const minWidth = 80;
  const minHeight = 50;
  const getRotation = () => Number(item.dataset.rotation || 0);
  const applyRotation = deg => {
    item.dataset.rotation = String(deg);
    item.style.transform = `rotate(${deg}deg)`;
  };
  const startDrag = startEvt => {
    startEvt.preventDefault();
    const canvasRect = canvas.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const startX = startEvt.clientX;
    const startY = startEvt.clientY;
    const initialLeft = itemRect.left - canvasRect.left;
    const initialTop = itemRect.top - canvasRect.top;
    const onMove = moveEvt => {
      const nextLeft = Math.max(0, initialLeft + (moveEvt.clientX - startX));
      const nextTop = Math.max(0, initialTop + (moveEvt.clientY - startY));
      item.style.left = `${nextLeft}px`;
      item.style.top = `${nextTop}px`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  item.querySelectorAll(".nv-edge-grab").forEach(edge => {
    edge.addEventListener("pointerdown", startDrag);
  });
  item.querySelectorAll(".nv-resize-handle").forEach(handle => {
    handle.addEventListener("pointerdown", createAddEventListenerPointerdownHandler({
      get handle() {
        return handle;
      },
      get item() {
        return item;
      },
      get minWidth() {
        return minWidth;
      },
      get minHeight() {
        return minHeight;
      }
    }));
  });
  const rotateHandle = item.querySelector(".nv-rotate-handle");
  if (rotateHandle) {
    rotateHandle.addEventListener("pointerdown", e => {
      e.preventDefault();
      const itemRect = item.getBoundingClientRect();
      const cx = itemRect.left + itemRect.width / 2;
      const cy = itemRect.top + itemRect.height / 2;
      const startRotation = getRotation();
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
      const onMove = moveEvt => {
        const angle = Math.atan2(moveEvt.clientY - cy, moveEvt.clientX - cx);
        const deg = startRotation + (angle - startAngle) * 180 / Math.PI;
        applyRotation(Math.round(deg));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }
  applyRotation(getRotation());
}

export function ensureCanvasResizeHandles(canvas) {
  if (canvas.querySelectorAll(".nv-canvas-resize-handle").length > 0) return;
  const resizeDirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  resizeDirs.forEach(dir => {
    const h = document.createElement("div");
    h.className = "nv-resize-handle nv-canvas-resize-handle";
    h.dataset.dir = dir;
    markEditorOnly(h);
    canvas.appendChild(h);
  });
}

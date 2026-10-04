// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateOnResizeStartHandler.mjs
// This module implements create On Resize Start Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createPanelDragMoveHandler } from "./CreateCanvasResizeMoveHandler.mjs";

// Create On Resize Start Handler operations.
export function createOnResizeStartHandler(owner) {
  return (handle, startEvt) => {
    startEvt.preventDefault();
    const dir = handle.dataset.dir || "se";
    const startX = startEvt.clientX;
    const startY = startEvt.clientY;
    const startWidth = owner.canvas.offsetWidth;
    const startHeight = owner.canvas.offsetHeight;
    const styles = window.getComputedStyle(owner.canvas);
    const startMarginLeft = parseFloat(styles.marginLeft) || 0;
    const startMarginTop = parseFloat(styles.marginTop) || 0;
    owner.canvas.style.width = `${startWidth}px`;
    owner.canvas.style.height = `${startHeight}px`;
    const onMove = createPanelDragMoveHandler({
      get startX() {
        return startX;
      },
      get startY() {
        return startY;
      },
      get startWidth() {
        return startWidth;
      },
      get startHeight() {
        return startHeight;
      },
      get startMarginLeft() {
        return startMarginLeft;
      },
      get startMarginTop() {
        return startMarginTop;
      },
      get dir() {
        return dir;
      },
      get minWidth() {
        return owner.minWidth;
      },
      get minHeight() {
        return owner.minHeight;
      },
      get canvas() {
        return owner.canvas;
      }
    });
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
}

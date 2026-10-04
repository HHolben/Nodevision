// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCanvasResizeMoveHandler.mjs
// This module implements create Canvas Resize Move Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Canvas Resize Move Handler operations.
export function createCanvasResizeMoveHandler(owner) {
  return moveEvt => {
    const dx = moveEvt.clientX - owner.startX;
    const dy = moveEvt.clientY - owner.startY;
    let nextLeft = owner.startLeft;
    let nextTop = owner.startTop;
    let nextWidth = owner.startWidth;
    let nextHeight = owner.startHeight;
    if (owner.dir.includes("e")) nextWidth = Math.max(owner.minWidth, owner.startWidth + dx);
    if (owner.dir.includes("s")) nextHeight = Math.max(owner.minHeight, owner.startHeight + dy);
    if (owner.dir.includes("w")) {
      nextWidth = Math.max(owner.minWidth, owner.startWidth - dx);
      nextLeft = owner.startLeft + (owner.startWidth - nextWidth);
    }
    if (owner.dir.includes("n")) {
      nextHeight = Math.max(owner.minHeight, owner.startHeight - dy);
      nextTop = owner.startTop + (owner.startHeight - nextHeight);
    }
    owner.item.style.left = `${nextLeft}px`;
    owner.item.style.top = `${nextTop}px`;
    owner.item.style.width = `${nextWidth}px`;
    owner.item.style.height = `${nextHeight}px`;
  };
}

export function createAddEventListenerPointerdownHandler(owner) {
  return e => {
    e.preventDefault();
    const dir = owner.handle.dataset.dir || "se";
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseFloat(owner.item.style.left) || 0;
    const startTop = parseFloat(owner.item.style.top) || 0;
    const startWidth = owner.item.offsetWidth;
    const startHeight = owner.item.offsetHeight;
    const onMove = createCanvasResizeMoveHandler({
      get startX() {
        return startX;
      },
      get startY() {
        return startY;
      },
      get startLeft() {
        return startLeft;
      },
      get startTop() {
        return startTop;
      },
      get startWidth() {
        return startWidth;
      },
      get startHeight() {
        return startHeight;
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
      get item() {
        return owner.item;
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

export function createPanelDragMoveHandler(owner) {
  return moveEvt => {
    const dx = moveEvt.clientX - owner.startX;
    const dy = moveEvt.clientY - owner.startY;
    let nextWidth = owner.startWidth;
    let nextHeight = owner.startHeight;
    let nextMarginLeft = owner.startMarginLeft;
    let nextMarginTop = owner.startMarginTop;
    if (owner.dir.includes("e")) nextWidth = Math.max(owner.minWidth, owner.startWidth + dx);
    if (owner.dir.includes("s")) nextHeight = Math.max(owner.minHeight, owner.startHeight + dy);
    if (owner.dir.includes("w")) {
      nextWidth = Math.max(owner.minWidth, owner.startWidth - dx);
      nextMarginLeft = owner.startMarginLeft + (owner.startWidth - nextWidth);
    }
    if (owner.dir.includes("n")) {
      nextHeight = Math.max(owner.minHeight, owner.startHeight - dy);
      nextMarginTop = owner.startMarginTop + (owner.startHeight - nextHeight);
    }
    owner.canvas.style.width = `${nextWidth}px`;
    owner.canvas.style.height = `${nextHeight}px`;
    owner.canvas.style.marginLeft = `${nextMarginLeft}px`;
    owner.canvas.style.marginTop = `${nextMarginTop}px`;
  };
}

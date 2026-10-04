// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateSyncImageHandlesNowHandler.mjs
// This module implements create Sync Image Handles Now Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Sync Image Handles Now Handler operations.
export function createSyncImageHandlesNowHandler(owner) {
  return () => {
    owner.imageToolsState.handleSyncRaf = 0;
    if (owner.imageToolsState.removed) return;
    const imageEl = owner.imageToolsState.selectedImageForHandles;
    if (!(imageEl instanceof HTMLImageElement) || !imageEl.isConnected) {
      owner.imageToolsState.hideImageHandles();
      return;
    }
    if (!owner.wysiwyg.contains(imageEl)) {
      owner.imageToolsState.hideImageHandles();
      return;
    }
    if (imageEl.closest(".nv-canvas-item")) {
      owner.imageToolsState.hideImageHandles();
      return;
    }
    const rect = imageEl.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width < 2 || rect.height < 2) {
      owner.imageToolsState.hideImageHandles();
      return;
    }
    const points = {
      nw: {
        x: rect.left,
        y: rect.top
      },
      ne: {
        x: rect.right,
        y: rect.top
      },
      sw: {
        x: rect.left,
        y: rect.bottom
      },
      se: {
        x: rect.right,
        y: rect.bottom
      }
    };
    owner.imageToolsState.cornerHandles.forEach((handle, corner) => {
      const pt = points[corner];
      handle.style.left = `${pt.x}px`;
      handle.style.top = `${pt.y}px`;
      handle.style.display = "block";
    });
  };
}

export function createImageCornerMoveHandler(owner) {
  return moveEvt => {
    moveEvt.preventDefault();
    if (owner.rotateMode) {
      const nextAngle = Math.atan2(moveEvt.clientY - owner.centerY, moveEvt.clientX - owner.centerX);
      let degrees = owner.startRotation + (nextAngle - owner.startAngle) * 180 / Math.PI;
      if (moveEvt.shiftKey && moveEvt.ctrlKey) {
        degrees = Math.round(degrees / 45) * 45;
      }
      owner.imageToolsState.applyImageRotation(owner.imageEl, degrees);
    } else {
      const nextDistance = Math.max(1, Math.hypot(moveEvt.clientX - owner.centerX, moveEvt.clientY - owner.centerY));
      const scale = nextDistance / owner.startDistance;
      const nextWidth = owner.imageToolsState.clamp(owner.startWidth * scale, 16, 4096);
      const nextHeight = owner.imageToolsState.clamp(nextWidth / Math.max(owner.aspect, 0.01), 16, 4096);
      owner.imageEl.style.width = `${Math.round(nextWidth)}px`;
      owner.imageEl.style.height = `${Math.round(nextHeight)}px`;
      if (!owner.imageEl.style.display || owner.imageEl.style.display === "inline") {
        owner.imageEl.style.display = "inline-block";
      }
    }
    owner.imageToolsState.scheduleImageHandleSync();
  };
}

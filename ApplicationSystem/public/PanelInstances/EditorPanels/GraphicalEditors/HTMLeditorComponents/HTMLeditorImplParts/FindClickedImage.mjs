// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/FindClickedImage.mjs
// This module implements find Clicked Image behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Find Clicked Image operations.
export function findClickedImage(target) {
  if (!(target instanceof Element)) return null;
  const direct = target.closest("img");
  if (direct instanceof HTMLImageElement) return direct;
  const item = target.closest(".nv-canvas-item");
  if (!item) return null;
  const nested = item.querySelector("img");
  return nested instanceof HTMLImageElement ? nested : null;
}

export function attachUndockedDragBehavior(container, header) {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let activePointerId = null;
  let hasWindowDragListeners = false;
  header.style.touchAction = "none";
  const onPointerMove = evt => {
    if (!dragging || evt.pointerId !== activePointerId) return;
    container.style.left = `${evt.clientX - offsetX}px`;
    container.style.top = `${evt.clientY - offsetY}px`;
  };
  const endDrag = evt => {
    if (!dragging || evt.pointerId !== activePointerId) return;
    dragging = false;
    container.style.userSelect = "";
    container.style.willChange = "";
    try {
      header.releasePointerCapture?.(evt.pointerId);
    } catch (_) {
      // No-op: window listeners handle cleanup as fallback.
    }
    activePointerId = null;
    removeWindowDragListeners();
  };
  const onWindowBlur = () => {
    if (!dragging) return;
    dragging = false;
    container.style.userSelect = "";
    container.style.willChange = "";
    activePointerId = null;
    removeWindowDragListeners();
  };
  function addWindowDragListeners() {
    if (hasWindowDragListeners) return;
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
    window.addEventListener("blur", onWindowBlur);
    hasWindowDragListeners = true;
  }
  function removeWindowDragListeners() {
    if (!hasWindowDragListeners) return;
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", endDrag, true);
    window.removeEventListener("pointercancel", endDrag, true);
    window.removeEventListener("blur", onWindowBlur);
    hasWindowDragListeners = false;
  }
  header.addEventListener("pointerdown", evt => {
    if (evt.target?.closest?.("button, a, input, select, textarea")) return;
    dragging = true;
    activePointerId = evt.pointerId;
    const rect = container.getBoundingClientRect();
    offsetX = evt.clientX - rect.left;
    offsetY = evt.clientY - rect.top;
    container.style.userSelect = "none";
    container.style.willChange = "left, top";
    addWindowDragListeners();
    try {
      header.setPointerCapture?.(evt.pointerId);
    } catch (_) {
      // No-op: window listeners still keep drag active.
    }
    evt.preventDefault();
  });
}

export function createUndockedEditorPanel(title = "Image Editor") {
  const floatingEl = document.createElement("div");
  floatingEl.className = "undocked-panel-float";
  floatingEl.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.2))}px`;
  floatingEl.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.15))}px`;
  const header = document.createElement("div");
  header.className = "undocked-panel-header";
  const titleSpan = document.createElement("span");
  titleSpan.textContent = title;
  header.appendChild(titleSpan);
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.style.cssText = "font:11px monospace;padding:2px 8px;border:1px solid #666;background:#eee;cursor:pointer;display:none;";
  header.appendChild(closeBtn);
  const body = document.createElement("div");
  body.className = "undocked-panel-body";
  body.style.padding = "0";
  floatingEl.appendChild(header);
  floatingEl.appendChild(body);
  document.body.appendChild(floatingEl);
  attachUndockedDragBehavior(floatingEl, header);
  return {
    floatingEl,
    body,
    closeBtn
  };
}

export function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert blob to data URL"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

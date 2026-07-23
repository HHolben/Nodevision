// Nodevision/ApplicationSystem/public/panels/panelResize.mjs
// Handles edge-aware resizing for floating panels.

const EDGE_THRESHOLD = 12;
const TOUCH_HANDLE_SIZE = 32;

function isNearEdge(x, y, rect) {
  const insideX = x >= rect.left && x <= rect.right;
  const insideY = y >= rect.top && y <= rect.bottom;
  if (!insideX || !insideY) return false;
  const distX = Math.min(x - rect.left, rect.right - x);
  const distY = Math.min(y - rect.top, rect.bottom - y);
  return distX <= EDGE_THRESHOLD || distY <= EDGE_THRESHOLD;
}

function clampSize(value, min, max) {
  const lower = typeof min === "number" ? min : 120;
  const upper = typeof max === "number" ? max : Number.POSITIVE_INFINITY;
  return Math.max(lower, Math.min(upper, value));
}

function ensureTouchResizeHandle(resizer) {
  let handle = resizer.querySelector?.(".panel-resizer-touch-handle");
  if (handle) return handle;

  handle = document.createElement("div");
  handle.className = "panel-resizer-touch-handle";
  handle.setAttribute("aria-hidden", "true");
  Object.assign(handle.style, {
    position: "absolute",
    right: "0",
    bottom: "0",
    width: `${TOUCH_HANDLE_SIZE}px`,
    height: `${TOUCH_HANDLE_SIZE}px`,
    cursor: "nwse-resize",
    pointerEvents: "auto",
    touchAction: "none",
    userSelect: "none",
  });
  resizer.appendChild(handle);
  return handle;
}

export function attachResizeEvents(panel, resizer) {
  let isResizing = false;
  let activePointerId = null;
  let resizePointerTarget = null;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;

  const minWidth = panel.style.minWidth ? parseInt(panel.style.minWidth, 10) : 260;
  const minHeight = panel.style.minHeight ? parseInt(panel.style.minHeight, 10) : 180;
  const touchHandle = ensureTouchResizeHandle(resizer);

  function updateResizerVisibility() {
    if (panel.classList.contains("floating")) {
      resizer.style.display = "block";
      resizer.style.pointerEvents = "none";
      resizer.style.touchAction = "none";
      resizer.style.userSelect = "none";
      touchHandle.style.pointerEvents = "auto";
    } else {
      resizer.style.display = "none";
      touchHandle.style.pointerEvents = "none";
    }
  }

  function startResize(event, { requireEdge = true } = {}) {
    if (!panel.classList.contains("floating")) return false;
    if (event.button !== undefined && event.button !== 0) return false;
    if (activePointerId !== null) return false;

    const rect = panel.getBoundingClientRect();
    if (requireEdge && !isNearEdge(event.clientX, event.clientY, rect)) return false;

    isResizing = true;
    activePointerId = event.pointerId;
    resizePointerTarget = event.currentTarget || panel;
    startX = event.clientX;
    startY = event.clientY;
    startWidth = rect.width;
    startHeight = rect.height;
    panel.style.willChange = "width, height";
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    resizePointerTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    return true;
  }

  function onPointerDown(event) {
    if (event.target?.closest?.(".panel-header")) return;
    if (event.target?.closest?.(".panel-resizer-touch-handle")) return;
    startResize(event, { requireEdge: true });
  }

  function onTouchHandlePointerDown(event) {
    if (startResize(event, { requireEdge: false })) {
      event.stopPropagation();
    }
  }

  function onWindowPointerMove(event) {
    if (!isResizing) return;
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    const maxWidth = Math.max(minWidth, window.innerWidth - panel.getBoundingClientRect().left - 20);
    const maxHeight = Math.max(minHeight, window.innerHeight - panel.getBoundingClientRect().top - 20);
    const nextWidth = clampSize(startWidth + deltaX, minWidth, maxWidth);
    const nextHeight = clampSize(startHeight + deltaY, minHeight, maxHeight);
    panel.style.width = `${nextWidth}px`;
    panel.style.height = `${nextHeight}px`;
  }

  function onWindowPointerUp(event) {
    if (!isResizing) return;
    if (event?.pointerId !== undefined && event.pointerId !== activePointerId) return;
    resizePointerTarget?.releasePointerCapture?.(activePointerId);
    isResizing = false;
    activePointerId = null;
    resizePointerTarget = null;
    panel.style.willChange = "";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  function updateCursor(event) {
    if (isResizing) {
      panel.style.cursor = "nwse-resize";
      return;
    }
    if (!panel.classList.contains("floating")) {
      panel.style.cursor = "";
      return;
    }
    const rect = panel.getBoundingClientRect();
    if (isNearEdge(event.clientX, event.clientY, rect)) {
      panel.style.cursor = "nwse-resize";
    } else {
      panel.style.cursor = "";
    }
  }

  panel.addEventListener("pointerdown", onPointerDown, true);
  touchHandle.addEventListener("pointerdown", onTouchHandlePointerDown);
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointercancel", onWindowPointerUp);
  window.addEventListener("pointermove", updateCursor);

  updateResizerVisibility();
  const observer = new MutationObserver(updateResizerVisibility);
  observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
}

// Nodevision/public/panels/panelResize.mjs
// Handles edge-aware resizing for floating panels.

const EDGE_THRESHOLD = 12;

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

export function attachResizeEvents(panel, resizer) {
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;

  const minWidth = panel.style.minWidth ? parseInt(panel.style.minWidth, 10) : 260;
  const minHeight = panel.style.minHeight ? parseInt(panel.style.minHeight, 10) : 180;

  function updateResizerVisibility() {
    if (panel.classList.contains("floating")) {
      resizer.style.display = "block";
      resizer.style.pointerEvents = "none";
    } else {
      resizer.style.display = "none";
    }
  }

  function onPointerDown(event) {
    if (!panel.classList.contains("floating")) return;
    if (event.button !== 0) return;
    if (event.target?.closest?.(".panel-header")) return;
    const rect = panel.getBoundingClientRect();
    if (!isNearEdge(event.clientX, event.clientY, rect)) return;

    isResizing = true;
    startX = event.clientX;
    startY = event.clientY;
    startWidth = rect.width;
    startHeight = rect.height;
    panel.style.willChange = "width, height";
    event.preventDefault();
  }

  function onWindowPointerMove(event) {
    if (!isResizing) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    const maxWidth = Math.max(minWidth, window.innerWidth - panel.getBoundingClientRect().left - 20);
    const maxHeight = Math.max(minHeight, window.innerHeight - panel.getBoundingClientRect().top - 20);
    const nextWidth = clampSize(startWidth + deltaX, minWidth, maxWidth);
    const nextHeight = clampSize(startHeight + deltaY, minHeight, maxHeight);
    panel.style.width = `${nextWidth}px`;
    panel.style.height = `${nextHeight}px`;
  }

  function onWindowPointerUp() {
    if (!isResizing) return;
    isResizing = false;
    panel.style.willChange = "";
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
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointermove", updateCursor);

  updateResizerVisibility();
  const observer = new MutationObserver(updateResizerVisibility);
  observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
}

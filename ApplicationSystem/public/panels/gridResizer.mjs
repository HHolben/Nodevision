// Nodevision/ApplicationSystem/public/panels/gridResizer.mjs
// This file defines browser-side grid Resizer logic for the Nodevision UI. It renders interface components and handles user interactions.

export function makeGridResizable(root, options = {}) {
  const minSize = options.minSize || 50; // Minimum pane width/height
  const dividers = root.querySelectorAll(".divider");

  let isDragging = false;
  let activePointerId = null;
  let currentDivider = null;
  let orientation = null;
  let leftPane, rightPane, topPane, bottomPane;
  let startX, startY, startLeftWidth, startRightWidth, startTopHeight, startBottomHeight;

  function createOverlay(cursor) {
    const overlay = document.createElement("div");
    overlay.id = "resize-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      cursor,
      zIndex: 9999,
      touchAction: "none",
      userSelect: "none",
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  dividers.forEach(divider => {
    divider.style.touchAction = "none";
    divider.style.userSelect = "none";

    divider.addEventListener("pointerdown", e => {
      if (e.button !== undefined && e.button !== 0) return;
      if (activePointerId !== null) return;
      e.preventDefault();
      isDragging = true;
      activePointerId = e.pointerId;
      currentDivider = divider;
      orientation = divider.dataset.orientation;
      document.body.style.cursor = orientation === "vertical" ? "ew-resize" : "ns-resize";
      document.body.style.userSelect = "none";
      divider.setPointerCapture?.(e.pointerId);

      if (orientation === "vertical") {
        leftPane = divider.previousElementSibling;
        rightPane = divider.nextElementSibling;
        startX = e.clientX;
        startLeftWidth = leftPane.offsetWidth;
        startRightWidth = rightPane.offsetWidth;
      }

      if (orientation === "horizontal") {
        topPane = divider.previousElementSibling;
        bottomPane = divider.nextElementSibling;
        startY = e.clientY;
        startTopHeight = topPane.offsetHeight;
        startBottomHeight = bottomPane.offsetHeight;
      }

      createOverlay(orientation === "vertical" ? "ew-resize" : "ns-resize");
    });
  });

  document.addEventListener("pointermove", e => {
    if (!isDragging) return;
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();

    if (orientation === "vertical") {
      const deltaX = e.clientX - startX;
      const newLeftWidth = startLeftWidth + deltaX;
      const newRightWidth = startRightWidth - deltaX;
      if (newLeftWidth > minSize && newRightWidth > minSize) {
        leftPane.style.width = newLeftWidth + "px";
        rightPane.style.width = newRightWidth + "px";
      }
    }

    if (orientation === "horizontal") {
      const deltaY = e.clientY - startY;
      const newTopHeight = startTopHeight + deltaY;
      const newBottomHeight = startBottomHeight - deltaY;
      if (newTopHeight > minSize && newBottomHeight > minSize) {
        topPane.style.height = newTopHeight + "px";
        bottomPane.style.height = newBottomHeight + "px";
      }
    }
  });

  function stopDragging(e) {
    if (!isDragging) return;
    if (e?.pointerId !== undefined && e.pointerId !== activePointerId) return;
    currentDivider?.releasePointerCapture?.(activePointerId);
    isDragging = false;
    activePointerId = null;
    currentDivider = null;
    orientation = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    const overlay = document.getElementById("resize-overlay");
    if (overlay) overlay.remove();
  }

  document.addEventListener("pointerup", stopDragging);
  document.addEventListener("pointercancel", stopDragging);
}

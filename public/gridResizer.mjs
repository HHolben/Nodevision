// Nodevision/public/gridResizer.mjs
// ES Module for making a grid of panes resizable with vertical and horizontal dividers

export function makeGridResizable(root, options = {}) {
  const minSize = options.minSize || 50; // Minimum pane width/height
  const dividers = root.querySelectorAll(".divider");

  let isDragging = false;
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
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  dividers.forEach(divider => {
    divider.addEventListener("mousedown", e => {
      e.preventDefault();
      isDragging = true;
      currentDivider = divider;
      orientation = divider.dataset.orientation;

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

  document.addEventListener("mousemove", e => {
    if (!isDragging) return;

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

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    currentDivider = null;
    orientation = null;

    const overlay = document.getElementById("resize-overlay");
    if (overlay) overlay.remove();
  });
}

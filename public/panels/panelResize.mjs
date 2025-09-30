// Nodevision/public/panels/panelResize.mjs
//This module adds the resizing logic needed for floating panels.

export function attachResizeEvents(panel, resizer) {
  let isResizing = false;
  let startX, startY, startWidth, startHeight;

  resizer.addEventListener("mousedown", (e) => {
    if (!panel.classList.contains("floating")) return;

    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
    startHeight = parseInt(document.defaultView.getComputedStyle(panel).height, 10);

    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    panel.style.width = startWidth + (e.clientX - startX) + "px";
    panel.style.height = startHeight + (e.clientY - startY) + "px";
  });

  window.addEventListener("mouseup", () => {
    isResizing = false;
  });

  // Show/hide resizer depending on state
  const observer = new MutationObserver(() => {
    if (panel.classList.contains("floating")) {
      resizer.style.display = "block";
    } else {
      resizer.style.display = "none";
    }
  });
  observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
}

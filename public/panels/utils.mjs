// Nodevision/public/panels/utils.mjs
//This module adds shared helpers.
export function bringToFront(panel) {
  const zIndexes = Array.from(document.querySelectorAll(".panel"))
    .map((p) => parseInt(p.style.zIndex) || 1000);
  panel.style.zIndex = Math.max(...zIndexes, 1000) + 1;
}

export function createOverlayLayer() {
  let overlay = document.getElementById("overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "overlay";
    Object.assign(overlay.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    });
    document.body.appendChild(overlay);
  }
  return overlay;
}

export function styleControlButton(btn) {
  Object.assign(btn.style, {
    border: "none",
    background: "#555",
    color: "white",
    padding: "2px 5px",
    fontSize: "11px",
    cursor: "pointer",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#777";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#555";
  });
}

// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/crosshair.mjs
// This file creates the on-screen crosshair overlay for the game view.

export function addCrosshair(panel) {
  const crosshair = document.createElement("div");
  crosshair.style.position = "absolute";
  crosshair.style.top = "50%";
  crosshair.style.left = "50%";
  crosshair.style.transform = "translate(-50%, -50%)";
  crosshair.style.width = "20px";
  crosshair.style.height = "20px";
  crosshair.style.border = "2px solid white";
  crosshair.style.borderRadius = "50%";
  crosshair.style.pointerEvents = "none";
  crosshair.style.zIndex = "10";
  panel.appendChild(crosshair);
  return crosshair;
}

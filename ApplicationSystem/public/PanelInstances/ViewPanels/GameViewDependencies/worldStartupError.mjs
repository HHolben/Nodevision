// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldStartupError.mjs
// This module displays recoverable virtual-world startup failures inside their owning panel. It preserves technical diagnostics and exposes an explicit retry action.

import { applyOverlayButtonAppearance } from "/OverlayAppearance.mjs";

// Keep user-facing recovery controls separate from expandable browser diagnostics.
export function showWorldStartupError(panel, error, retry) {
  const message = document.createElement("div");
  message.className = "gameview-startup-error";
  message.setAttribute("role", "alert");
  message.style.cssText = "box-sizing:border-box;padding:var(--nv-world-error-padding,24px);max-height:100%;overflow:auto;color:inherit;font:var(--nv-world-error-font,inherit);";
  const title = document.createElement("h3");
  title.textContent = error.code === "WEBGL_UNAVAILABLE" ? "3D graphics unavailable" : "Could not open Virtual World";
  const description = document.createElement("p");
  description.textContent = error.code === "WEBGL_UNAVAILABLE"
    ? "The browser could not start WebGL. Try restarting your browser or desktop app and checking its graphics acceleration settings, then retry."
    : "Virtual World could not finish starting. Retry to open this world again.";
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Technical details";
  const diagnostic = document.createElement("pre");
  diagnostic.style.whiteSpace = "pre-wrap";
  diagnostic.textContent = [error.message || String(error), error.details].filter(Boolean).join("\n");
  details.append(summary, diagnostic);
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Retry";
  applyOverlayButtonAppearance(button);
  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Retrying…";
    retry();
  });
  message.append(title, description, button, details);
  panel.replaceChildren(message);
}

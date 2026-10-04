// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/htmlPropertiesButton.mjs
// This module opens the standard HTML Properties panel as an overlay so the owning graphical editor remains mounted and visible.
import { openNodevisionOverlayPanel } from '/TemplateSystem/NodevisionOverlayPanel.mjs';
export function initToolbarWidget(host) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = 'HTML Properties';
  button.addEventListener('click', () => { void openNodevisionOverlayPanel('HTMLPropertiesPanel'); });
  host.append(button);
}

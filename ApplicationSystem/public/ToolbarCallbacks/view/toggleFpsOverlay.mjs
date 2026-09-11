// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/toggleFpsOverlay.mjs
// Toggles the workspace-wide FPS/frame-time overlay from the View menu.

import { toggleFpsOverlay as toggleOverlay } from "/FpsOverlay.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

export default function toggleFpsOverlay() {
  const enabled = toggleOverlay();
  updateToolbarState({ fpsOverlayVisible: enabled });
  return enabled;
}

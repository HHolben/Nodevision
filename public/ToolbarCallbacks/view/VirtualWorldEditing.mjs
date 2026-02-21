// Nodevision/public/ToolbarCallbacks/view/VirtualWorldEditing.mjs
// Switches GameView into creative editing mode.

import { updateToolbarState } from "/panels/createToolbar.mjs";

export default function VirtualWorldEditing() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.virtualWorldMode = "creative";
  window.NodevisionState.currentMode = "Virtual World Editing";
  updateToolbarState({
    currentMode: "Virtual World Editing",
    virtualWorldMode: "creative"
  });

  if (window.VRWorldContext?.setPlayerMode) {
    window.VRWorldContext.setPlayerMode("creative");
  }
}

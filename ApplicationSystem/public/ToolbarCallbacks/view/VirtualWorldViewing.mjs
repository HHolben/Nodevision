// Nodevision/public/ToolbarCallbacks/view/VirtualWorldViewing.mjs
// Switches GameView into survival viewing mode.

import { updateToolbarState } from "/panels/createToolbar.mjs";

export default function VirtualWorldViewing() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.virtualWorldMode = "survival";
  window.NodevisionState.currentMode = "Virtual World Viewing";
  updateToolbarState({
    currentMode: "Virtual World Viewing",
    virtualWorldMode: "survival"
  });

  if (window.VRWorldContext?.setPlayerMode) {
    window.VRWorldContext.setPlayerMode("survival");
  }
}

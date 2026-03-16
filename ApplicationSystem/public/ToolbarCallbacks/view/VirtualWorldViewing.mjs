// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/VirtualWorldViewing.mjs
// This file defines browser-side Virtual World Viewing logic for the Nodevision UI. It renders interface components and handles user interactions.

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

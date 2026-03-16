// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/VirtualWorldEditing.mjs
// This file defines browser-side Virtual World Editing logic for the Nodevision UI. It renders interface components and handles user interactions.

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

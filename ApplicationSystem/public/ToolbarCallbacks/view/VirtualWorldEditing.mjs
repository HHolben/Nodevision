// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/VirtualWorldEditing.mjs
// This file defines browser-side Virtual World Editing logic for the Nodevision UI. The callback updates mode state and notifies MetaWorld editing panels.

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

  window.dispatchEvent(new CustomEvent("nodevision:metaworld-editing-enabled", {
    detail: { currentMode: "Virtual World Editing" }
  }));
}

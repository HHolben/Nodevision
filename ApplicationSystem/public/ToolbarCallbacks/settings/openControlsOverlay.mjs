// Nodevision/ApplicationSystem/public/ToolbarCallbacks/settings/openControlsOverlay.mjs
// This file opens the local control mappings reference overlay from the Settings toolbar.

export default async function openControlsOverlay() {
  try {
    const mod = await import("/Settings/ControlsOverlay.mjs");
    if (typeof mod.openControlsOverlay !== "function") throw new Error("openControlsOverlay export was not found.");
    await mod.openControlsOverlay();
  } catch (err) {
    console.error("Failed to open Control Mappings overlay:", err);
    alert("Unable to open Control Mappings.");
  }
}

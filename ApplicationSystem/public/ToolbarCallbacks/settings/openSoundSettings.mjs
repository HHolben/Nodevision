// Nodevision/ApplicationSystem/public/ToolbarCallbacks/settings/openSoundSettings.mjs
// This file defines browser-side toolbar callback logic for opening the focus background audio sound settings overlay.

export default async function openSoundSettings() {
  try {
    const mod = await import("/Settings/SoundSettingsOverlay.mjs");
    if (typeof mod.openSoundSettingsOverlay === "function") {
      await mod.openSoundSettingsOverlay();
      return;
    }
    throw new Error("openSoundSettingsOverlay export was not found.");
  } catch (err) {
    console.error("Failed to open sound settings overlay:", err);
    alert("Unable to open Sound Settings.");
  }
}

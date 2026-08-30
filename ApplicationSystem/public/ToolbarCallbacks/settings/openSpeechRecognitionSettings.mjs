// Nodevision/ApplicationSystem/public/ToolbarCallbacks/settings/openSpeechRecognitionSettings.mjs
// This file opens the local dictation speech-recognition settings overlay from the Settings toolbar.

export default async function openSpeechRecognitionSettings() {
  try {
    const mod = await import("/Settings/SpeechRecognitionSettingsOverlay.mjs");
    if (typeof mod.openSpeechRecognitionSettingsOverlay === "function") {
      await mod.openSpeechRecognitionSettingsOverlay();
      return;
    }
    throw new Error("openSpeechRecognitionSettingsOverlay export was not found.");
  } catch (err) {
    console.error("Failed to open dictation settings overlay:", err);
    alert("Unable to open Dictation Settings.");
  }
}

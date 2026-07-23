// Nodevision/ApplicationSystem/public/ToolbarCallbacks/settings/Timeout.mjs
// Opens the app timeout settings dialog from Settings -> Timeout.

export default async function Timeout() {
  try {
    const api = window.NodevisionAppTimeout;
    if (!api || typeof api.openSettings !== "function") {
      throw new Error("Timeout settings are not available yet.");
    }
    await api.openSettings();
  } catch (err) {
    console.error("Failed to open timeout settings:", err);
    alert("Unable to open Timeout settings.");
  }
}

// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/reloadApp.mjs
// Reloads the app shell while preserving the current authenticated browser session.

import { setStatus } from "/StatusBar.mjs";

export default function reloadApp() {
  try {
    setStatus("Reload app", "Restarting workspace");
  } catch {
    // The reload should still proceed if the status bar has not initialized.
  }

  window.location.reload();
}

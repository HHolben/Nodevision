// Nodevision/ApplicationSystem/public/ToolbarCallbacks/settings/openUserPreferences.mjs
// Opens User Preferences as the only panel in the workspace.

import { replaceWorkspaceWithPanel } from "/panels/workspace.mjs";

export default async function openUserPreferences() {
  try {
    await replaceWorkspaceWithPanel("UserPreferencesPanel", {
      displayName: "User Preferences",
      panelClass: "InfoPanel",
    });
  } catch (err) {
    console.error("Failed to open User Preferences:", err);
    alert("Unable to open User Preferences.");
  }
}

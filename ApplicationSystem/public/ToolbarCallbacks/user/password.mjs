// Nodevision/public/ToolbarCallbacks/user/password.mjs
// Opens the change-password panel as a standard InfoPanel.
import { openFloatingInfoPanel } from "/panels/userPanelLauncher.mjs";

export default async function password() {
  await openFloatingInfoPanel("PasswordPanel", "Change Password");
}

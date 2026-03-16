// Nodevision/ApplicationSystem/public/ToolbarCallbacks/user/password.mjs
// This file defines browser-side password logic for the Nodevision UI. It renders interface components and handles user interactions.
import { openFloatingInfoPanel } from "/panels/userPanelLauncher.mjs";

export default async function password() {
  await openFloatingInfoPanel("PasswordPanel", "Change Password");
}

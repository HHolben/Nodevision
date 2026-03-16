// Nodevision/ApplicationSystem/public/ToolbarCallbacks/user/users.mjs
// This file defines browser-side users logic for the Nodevision UI. It renders interface components and handles user interactions.
import { openFloatingInfoPanel } from "/panels/userPanelLauncher.mjs";

export default async function users() {
  await openFloatingInfoPanel("UsersPanel", "Users");
}

// Nodevision/public/ToolbarCallbacks/user/users.mjs
// Opens the admin user management panel via the standard panel system.
import { openFloatingInfoPanel } from "/panels/userPanelLauncher.mjs";

export default async function users() {
  await openFloatingInfoPanel("UsersPanel", "Users");
}

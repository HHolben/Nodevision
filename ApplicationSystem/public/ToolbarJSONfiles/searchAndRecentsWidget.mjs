// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/searchAndRecentsWidget.mjs
// This file initializes the main-toolbar Search and Recents controls while keeping their behavior in separate modules.

import { initToolbarWidget as initSearchWidget } from "./searchWidget.mjs";
import { initRecentFilesDropdown } from "./recentFilesDropdown.mjs";

export function initToolbarWidget(root) {
  initSearchWidget(root);
  initRecentFilesDropdown(root);
}

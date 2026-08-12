// Nodevision/ApplicationSystem/public/RecentFileNavigation.mjs
// This file coordinates recently selected Notebook files with Nodevision's existing File Manager and Graph Manager navigation state.

function validNavigatorType(value) {
  const clean = String(value || "").trim();
  return clean === "FileManager" || clean === "GraphManager" ? clean : "";
}

function uniqueNavigatorTypes(values = []) {
  return [...new Set(values.map(validNavigatorType).filter(Boolean))];
}

function recentNavigatorCandidates(global) {
  const nav = global.NodevisionNavigationState || {};
  return uniqueNavigatorTypes([
    nav.getLastFileSelectionPanelType?.(),
    nav.getLastInfoPanelType?.(),
    global.NodevisionState?.activePanelType,
    "FileManager",
    "GraphManager",
  ]);
}

function navigatorIsOpen(global, panelType) {
  const byId = global.document?.getElementById?.bind(global.document);
  if (panelType === "FileManager") return Boolean(byId?.("file-list") && typeof global.revealPathInFileManager === "function");
  if (panelType === "GraphManager") return Boolean(byId?.("cy") && typeof global.revealPathInGraphManager === "function");
  return false;
}

export async function revealRecentFileInNavigator(global, path) {
  const nav = global.NodevisionNavigationState || {};
  for (const panelType of recentNavigatorCandidates(global)) {
    if (!navigatorIsOpen(global, panelType)) continue;
    try {
      if (panelType === "FileManager") {
        if (await global.revealPathInFileManager(path, { isDirectory: false, selectFile: false })) {
          nav.setLastFileSelectionPanelType?.("FileManager");
          return true;
        }
      }
      if (panelType === "GraphManager" && typeof global.revealPathInGraphManager === "function") {
        if (await global.revealPathInGraphManager(path, { isDirectory: false, selectFile: false })) {
          nav.setLastFileSelectionPanelType?.("GraphManager");
          return true;
        }
      }
    } catch (err) {
      console.warn(`[RecentFiles] Failed to reveal ${path} in ${panelType}:`, err);
    }
  }
  return false;
}

export function dispatchRecentSelection(global, path) {
  const detail = { filePath: path };
  global.document?.dispatchEvent?.(new CustomEvent("fileSelected", { detail }));
}

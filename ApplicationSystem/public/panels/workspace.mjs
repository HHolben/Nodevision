// Nodevision/ApplicationSystem/public/panels/workspace.mjs
// This facade preserves the public Nodevision workspace API while delegating layout, panel loading, splitting, serialization, and tracking behavior to focused workspaceParts modules.

import "/EditorSwitchGuard.mjs";
import { setupActivePanelTracking } from "./workspaceParts/workspaceActiveTracking.mjs";
import { installWorkspaceToolbarActions } from "./workspaceParts/workspaceToolbarActions.mjs";

export { clearActivePanelSelection } from "./workspaceParts/workspaceActivePanels.mjs";
export { createCell, ensureTopRow, ensureWorkspace } from "./workspaceParts/workspaceCells.mjs";
export { rebuildLayoutDividersForContainer } from "./workspaceParts/workspaceDividers.mjs";
export { loadDefaultLayout, renderLayout } from "./workspaceParts/workspaceLayoutRender.mjs";
export {
  ensureEditorModeLayout,
  ensureGifEditorModeLayout,
  ensureHandwritingOcrModeLayout,
  ensureKMLEditingModeLayout,
  ensureKMLEditorModeLayout,
  ensureKMLViewerModeLayout,
  ensureMidEditorModeLayout,
  ensureScadEditorModeLayout,
  ensureSvgEditorModeLayout,
} from "./workspaceParts/workspaceModeLayouts.mjs";
export { loadPanelIntoCell, replaceWorkspaceWithPanel } from "./workspaceParts/workspacePanelLoader.mjs";
export { serializeWorkspace } from "./workspaceParts/workspaceSerialization.mjs";
export { ensureAdjacentPanelCell } from "./workspaceParts/workspaceAdjacentPanel.mjs";
export { ensureSvgEditingSplit } from "./workspaceParts/workspaceSvgSplit.mjs";
export { openDirectoryEditingWorkspace } from "./workspaceParts/workspaceSpecialLayouts.mjs";

setupActivePanelTracking();
installWorkspaceToolbarActions();

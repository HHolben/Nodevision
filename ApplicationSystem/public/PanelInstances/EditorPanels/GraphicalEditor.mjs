// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditor.mjs
// This module assembles the shared GraphicalEditor features and preserves the public application interface.

import { GraphicalEditorModuleState } from "./GraphicalEditorParts/LoadModuleMap.mjs";
import { updateGraphicalEditor } from "./GraphicalEditorParts/UpdateGraphicalEditor.mjs";
import { activateGraphicalEditorHost } from "./GraphicalEditorParts/GetGraphicalEditorHost.mjs";
import { createNvGetGraphicalEditorFileSwitchTargetHandler } from "./GraphicalEditorParts/CleanupGraphicalEditorAttention.mjs";
export { graphicalLiveMutationRecordsContainDocumentChange } from './GraphicalEditorParts/ReadGraphicalLiveContent.mjs';
export { setupPanel } from './GraphicalEditorParts/GetGraphicalEditorHost.mjs';
export { updateGraphicalEditor } from './GraphicalEditorParts/UpdateGraphicalEditor.mjs';

// Install the module-level integration hooks.
GraphicalEditorModuleState.lastEditedPath = null;
GraphicalEditorModuleState.graphicalEditorHostRef = null;
GraphicalEditorModuleState.currentGraphicalEditorCleanup = null;
GraphicalEditorModuleState.currentGraphicalLiveCleanup = null;
GraphicalEditorModuleState.graphicalLiveProviderSequence = 0;
// Expose globally
window.updateGraphicalEditor = updateGraphicalEditor;
window.__nvActivateGraphicalEditorHost = activateGraphicalEditorHost;

// File Manager captures this target before its selection changes any global paths.
// File Manager captures this target before its selection changes any global paths.
window.__nvGetGraphicalEditorFileSwitchTarget = createNvGetGraphicalEditorFileSwitchTargetHandler({});

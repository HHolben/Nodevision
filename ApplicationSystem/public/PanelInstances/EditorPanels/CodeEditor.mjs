// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditor.mjs
// This module composes the CodeEditor implementation and preserves its public entry points and initialization behavior.

import "/EditorSwitchGuard.mjs";
import { isCodeEditorActive } from "./CodeEditorParts/IsCodeEditorActive.mjs";
import { openCodeEditor } from "./CodeEditorParts/OpenCodeEditor.mjs";
import { updateEditorPanel } from "./CodeEditorParts/RegisterCodeEditorLiveProvider.mjs";
import { activateCodeEditorHost } from "./CodeEditorParts/SetPreviewOutput.mjs";
export { openCodeEditor } from "./CodeEditorParts/OpenCodeEditor.mjs";
export { updateEditorPanel } from "./CodeEditorParts/RegisterCodeEditorLiveProvider.mjs";
export { setupPanel } from "./CodeEditorParts/IsCodeEditorActive.mjs";

if (typeof window !== "undefined") {
  window.isCodeEditorDirty = () => Boolean(window.__nvCodeEditorDirty);
  window.isCodeEditorActive = isCodeEditorActive;
}

window.openCodeEditor = openCodeEditor;

window.updateEditorPanel = updateEditorPanel;

window.__nvActivateCodeEditorHost = activateCodeEditorHost;

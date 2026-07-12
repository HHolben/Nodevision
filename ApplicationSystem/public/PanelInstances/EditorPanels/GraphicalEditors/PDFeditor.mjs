// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PDFeditor.mjs
// Graphical PDF editor backed by the shared native PDF workspace and SVG-compatible annotation overlays.

import { resetEditorHooks } from "./FamilyEditorCommon.mjs";
import { renderPdfWorkspace } from "/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditor.mjs";

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  await renderPdfWorkspace(filePath, container, { editable: true });
}

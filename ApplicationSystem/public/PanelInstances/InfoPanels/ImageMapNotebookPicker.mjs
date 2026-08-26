// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/ImageMapNotebookPicker.mjs
// This panel module hosts a reusable File Manager based Notebook picker for image-map href selection.

import { mountImageMapNotebookPicker } from "/PanelInstances/Common/ImageMap/ImageMapNotebookPicker.mjs";

export function createPanel(content, vars = {}) {
  const mounted = mountImageMapNotebookPicker(content, vars);
  content.__nvImageMapNotebookPickerCleanup = () => mounted.destroy?.();
}

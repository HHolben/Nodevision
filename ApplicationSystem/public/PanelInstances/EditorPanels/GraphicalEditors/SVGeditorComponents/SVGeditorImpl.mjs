// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorImpl.mjs
// This module renders the SVG graphical editor runtime and attaches small editor-specific extensions without expanding the large runtime module.

import { renderEditor as renderRuntimeEditor } from "./SVGeditorRuntime.mjs";
import { installSvgScaleHotkeys } from "./SvgScaleHotkeys.mjs";

// Runtime composition.
export async function renderEditor(filePath, container) {
  const cleanupRuntime = await renderRuntimeEditor(filePath, container);
  const cleanupScaleHotkeys = installSvgScaleHotkeys(container);
  return () => {
    cleanupScaleHotkeys?.();
    cleanupRuntime?.();
  };
}

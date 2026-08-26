// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/editImageMap.mjs
// This toolbar callback opens the reusable image-map editor for the currently selected mapped HTML image.

import { openImageMapEditOverlay } from "/PanelInstances/Common/ImageMap/HtmlImageMapAdapter.mjs";

export default async function editImageMap() {
  return openImageMapEditOverlay();
}

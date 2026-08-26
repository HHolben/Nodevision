// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertImageMap.mjs
// This toolbar callback opens the reusable image-map editor to insert a standard HTML img and map pair.

import { openImageMapInsertOverlay } from "/PanelInstances/Common/ImageMap/HtmlImageMapAdapter.mjs";

export default async function insertImageMap() {
  return openImageMapInsertOverlay();
}

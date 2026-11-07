// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/terrainRepresentationWidget.mjs
// This module mounts the shared terrain representation controls in the existing View toolbar and keeps repeated menu activation idempotent.
import { mountTerrainRepresentationControls } from '../MetaWorld/TerrainRepresentation/Controls.mjs';
export function initToolbarWidget(host) {
  return mountTerrainRepresentationControls(host);
}

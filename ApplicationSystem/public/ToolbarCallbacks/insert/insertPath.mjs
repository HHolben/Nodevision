// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertPath.mjs
// This Insert command starts physical-path authoring in editable virtual worlds and respects Sandbox Play's shared authoring restrictions.
import { beginPathDrawing } from '../../MetaWorld/Paths/PathInteraction.mjs';
export default function insertPath() {
  if(!['Virtual World Editing','VR World Editing'].includes(window.NodevisionState?.currentMode))return false;
  return beginPathDrawing();
}

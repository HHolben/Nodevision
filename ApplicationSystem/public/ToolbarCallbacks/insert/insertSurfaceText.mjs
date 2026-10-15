// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertSurfaceText.mjs
// This command inserts an editable surface text object through the active Virtual World layer bridge.
import { insertWorldText } from '../../MetaWorld/Text/TextPlacement.mjs';
export default function insertSurfaceText() { return insertWorldText('surface'); }

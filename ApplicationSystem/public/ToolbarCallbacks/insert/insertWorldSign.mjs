// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertWorldSign.mjs
// This command inserts an editable sign text object through the active Virtual World layer bridge.
import { insertWorldText } from '../../MetaWorld/Text/TextPlacement.mjs';
export default function insertWorldSign() { return insertWorldText('sign'); }

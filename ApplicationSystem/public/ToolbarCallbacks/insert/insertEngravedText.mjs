// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertEngravedText.mjs
// This command inserts an editable engraved text object through the active Virtual World layer bridge.
import { insertWorldText } from '../../MetaWorld/Text/TextPlacement.mjs';
export default function insertEngravedText() { return insertWorldText('engraved'); }

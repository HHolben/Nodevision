// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertRaisedText.mjs
// This command inserts an editable raised text object through the active Virtual World layer bridge.
import { insertWorldText } from '../../MetaWorld/Text/TextPlacement.mjs';
export default function insertRaisedText() { return insertWorldText('raised'); }

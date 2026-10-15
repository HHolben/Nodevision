// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertFreeStandingText.mjs
// This command inserts an editable free-standing text object through the active Virtual World layer bridge.
import { insertWorldText } from '../../MetaWorld/Text/TextPlacement.mjs';
export default function insertFreeStandingText() { return insertWorldText('free-standing'); }

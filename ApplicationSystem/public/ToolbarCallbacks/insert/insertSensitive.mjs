// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertSensitive.mjs
// Wraps selected content in a field that remains visible on screen and is omitted when printed.
import { insertStructure } from './structureInsertTools.mjs';
export default function insertSensitive() { return insertStructure('sensitive'); }

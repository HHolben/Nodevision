// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.mjs
// This module adapts shared immutable snapshot history to CSV documents. It preserves the existing CSV history interface while using row identity to distinguish document states.
// CSV and tiled terrain documents share the immutable-snapshot document history primitive.
import {createSnapshotHistory} from '../../Common/SnapshotHistory.mjs';
export function createCsvHistory(options){return createSnapshotHistory({...options,equal:(a,b)=>a.rows===b.rows});}

// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableTools.mjs
// This module assembles the shared tableTools features and preserves the public application interface.


export { setActiveTableCell } from './tableToolsParts/IsEditableTableRoot.mjs';
export { clearTableCellSelection } from './tableToolsParts/IsEditableTableRoot.mjs';
export { getSelectedTableCells } from './tableToolsParts/IsEditableTableRoot.mjs';
export { setSelectedTableCells } from './tableToolsParts/IsEditableTableRoot.mjs';
export { selectTableCellRange } from './tableToolsParts/ExpandRectToWholeCellSpans.mjs';
export { getActiveTableCell } from './tableToolsParts/ExpandRectToWholeCellSpans.mjs';
export { focusTableCell } from './tableToolsParts/ExpandRectToWholeCellSpans.mjs';
export { mergeActiveTableCell } from './tableToolsParts/MergeCellOrigins.mjs';
export { mergeSelectedTableCells } from './tableToolsParts/MergeCellOrigins.mjs';
export { splitCurrentTableCell } from './tableToolsParts/SplitOrdinaryTableCell.mjs';
export { moveActiveTableCell } from './tableToolsParts/SplitOrdinaryTableCell.mjs';
export { handleTableArrowKeyNavigation } from './tableToolsParts/SplitOrdinaryTableCell.mjs';
export { insertTableAtCaret } from './tableToolsParts/InsertTableAtCaret.mjs';
export { insertTableRow } from './tableToolsParts/InsertTableAtCaret.mjs';
export { deleteCurrentTableRow } from './tableToolsParts/InsertTableAtCaret.mjs';
export { deleteCurrentTableColumn } from './tableToolsParts/InsertTableAtCaret.mjs';
export { insertTableColumn } from './tableToolsParts/InsertTableAtCaret.mjs';

// Install the module-level integration hooks.

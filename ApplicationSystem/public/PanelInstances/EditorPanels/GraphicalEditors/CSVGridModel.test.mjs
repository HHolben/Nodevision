// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridModel.test.mjs
// Regression coverage for the graphical CSV editor's model-backed grid behavior.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  csvRenderDimensions,
  declaredColumnCount,
  deleteCsvColumn,
  deleteCsvRow,
  insertCsvColumn,
  insertCsvRow,
  isDeclaredCsvCell,
  parseDelimitedText,
  serializeDelimitedRows,
  setCsvCellValue,
} from "./CSVGridModel.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const csvEditorSource = readFileSync(join(here, "CSVeditor.mjs"), "utf8");
const tableToolsSource = readFileSync(join(here, "../../../ToolbarCallbacks/insert/tableTools.mjs"), "utf8");
const defaultToolbar = JSON.parse(readFileSync(join(here, "../../../ToolbarJSONfiles/defaultToolbar.json"), "utf8"));
const insertToolbar = JSON.parse(readFileSync(join(here, "../../../ToolbarJSONfiles/insertToolbar.json"), "utf8"));

const ragged = parseDelimitedText("A,B\nC");
assert.deepEqual(ragged, [["A", "B"], ["C"]], "CSV parser preserves ragged rows");
assert.equal(declaredColumnCount(ragged), 2, "declared width comes from the widest real row");
assert.equal(isDeclaredCsvCell(ragged, 1, 0), true, "existing ragged row cell is declared");
assert.equal(isDeclaredCsvCell(ragged, 1, 1), false, "missing ragged row cell stays virtual");
assert.deepEqual(csvRenderDimensions(ragged, { row: 1, col: 1 }), { rows: 3, cols: 3 }, "render dimensions include modest navigable virtual space");
assert.deepEqual(ragged, [["A", "B"], ["C"]], "navigation/render planning does not mutate CSV rows");

const materialized = setCsvCellValue([["A"]], 0, 2, "D");
assert.deepEqual(materialized, [["A", "", "D"]], "typing into a virtual cell materializes intermediate empty fields");
assert.equal(serializeDelimitedRows(materialized), "A,,D", "materialized intermediate fields serialize correctly");

assert.deepEqual(insertCsvColumn(ragged, 1), [["A", "", "B"], ["C", ""]], "insert column pads ragged rows only as far as the inserted logical field");
assert.deepEqual(deleteCsvColumn([["A", "", "B"], ["C"]], 1), [["A", "B"], ["C"]], "delete column skips rows that do not contain that field");
assert.deepEqual(insertCsvRow(ragged, 1, declaredColumnCount(ragged)), [["A", "B"], ["", ""], ["C"]], "insert row uses logical grid width");
assert.deepEqual(deleteCsvRow([["A"], ["B"]], 0), [["B"]], "delete row removes the selected CSV record");

const quoted = parseDelimitedText('"A,B","said ""hi"""\nC,D');
assert.deepEqual(quoted, [["A,B", 'said "hi"'], ["C", "D"]], "quoted fields parse without corruption");
const editedQuoted = setCsvCellValue(quoted, 1, 1, "line\nbreak");
assert.equal(serializeDelimitedRows(editedQuoted), '"A,B","said ""hi"""\nC,"line\nbreak"', "quoted fields survive editing and serialization");

assert.match(csvEditorSource, /nv-csv-virtual-cell/, "virtual cells receive a distinct CSS class");
assert.match(csvEditorSource, /outline:\s*1px dashed #c7ced8/, "virtual cells use a subtle light-gray outline");
assert.match(csvEditorSource, /data-nv-table-editor-root/, "CSV registers a table editor root for the shared table toolbar state");
assert.match(csvEditorSource, /__nvActiveGridTableContext/, "CSV publishes a grid table context for shared toolbar commands");
assert.match(csvEditorSource, /function caretOffsetInCell/, "CSV keyboard handling checks caret position before horizontal cell navigation");
assert.match(csvEditorSource, /setCsvCellValue\(csvRows, row, col/, "CSV input materializes virtual cells through the model");
assert.match(csvEditorSource, /insertCsvRow\(csvRows/, "CSV row toolbar operations use the CSV model");
assert.match(csvEditorSource, /insertCsvColumn\(csvRows/, "CSV column toolbar operations use the CSV model");
assert.match(csvEditorSource, /deleteCsvRow\(csvRows/, "CSV delete-row toolbar operation uses the CSV model");
assert.match(csvEditorSource, /deleteCsvColumn\(csvRows/, "CSV delete-column toolbar operation uses the CSV model");

assert.match(tableToolsSource, /getActiveGridTableContext/, "shared table tools check for a registered grid adapter");
assert.match(tableToolsSource, /data-nv-table-editor-root/, "shared table tools accept non-contenteditable table editor roots when registered");
assert.match(tableToolsSource, /const gridRoot = getActiveGridTableContext\(\)\?\.getEditorRoot\?\.\(\)/, "shared table tools prefer the active CSV/grid editor root before stale HTML roots");
assert.ok(csvEditorSource.includes("getEditorRoot() {\n      return tableWrapper;"), "CSV table context exposes its table wrapper as the active table editor root");
assert.match(tableToolsSource, /insertTableRow[\s\S]*gridContext\?\.insertRow/, "row insert callback routes to grid adapter before DOM table fallback");
assert.match(tableToolsSource, /insertTableColumn[\s\S]*gridContext\?\.insertColumn/, "column insert callback routes to grid adapter before DOM table fallback");
assert.match(tableToolsSource, /deleteCurrentTableRow[\s\S]*gridContext\?\.deleteRow/, "row delete callback routes to grid adapter before DOM table fallback");
assert.match(tableToolsSource, /deleteCurrentTableColumn[\s\S]*gridContext\?\.deleteColumn/, "column delete callback routes to grid adapter before DOM table fallback");

const tableButton = defaultToolbar.find((item) => item.heading === "Table" && item.callbackKey === "openTableToolbar");
assert.ok(tableButton?.modes?.includes("CSVediting"), "contextual Table button is available in CSVediting mode");
assert.deepEqual(tableButton.conditions, { htmlTableSelected: true }, "CSV reuses the existing HTML table-selected toolbar condition");
for (const callbackKey of ["tableInsertRowAbove", "tableInsertRowBelow", "tableDeleteRow", "tableInsertColumnLeft", "tableInsertColumnRight", "tableDeleteColumn"]) {
  const item = insertToolbar.find((candidate) => candidate.callbackKey === callbackKey);
  assert.ok(item?.modes?.includes("CSVediting"), `${callbackKey} is available for CSVediting`);
}

console.log("CSV grid model and table toolbar bridge tests passed");

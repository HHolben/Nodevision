// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridModel.mjs
// Pure CSV grid helpers used by the graphical CSV editor and its regression tests.

export function normalizeSpreadsheetDelimiter(delimiter) {
  return delimiter === "\t" ? "\t" : ",";
}

export function spreadsheetDelimiterForPath(path = "") {
  const cleanPath = String(path || "").split(/[?#]/)[0].toLowerCase();
  return cleanPath.endsWith(".tsv") ? "\t" : ",";
}

export function parseDelimitedText(text = "", delimiter = ",") {
  const source = String(text ?? "").replace(/\u0000/g, "");
  const separator = normalizeSpreadsheetDelimiter(delimiter);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === separator) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length || source.endsWith(separator)) {
    row.push(cell);
    rows.push(row);
  }

  return rows.length ? rows : [[""]];
}

export function serializeDelimitedRows(rows = [], delimiter = ",") {
  const separator = normalizeSpreadsheetDelimiter(delimiter);
  const serializeCell = (value) => {
    const text = String(value ?? "");
    if (text.includes(separator) || /["\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return rows.map((row) => (Array.isArray(row) ? row : []).map(serializeCell).join(separator)).join("\n");
}

export function cloneCsvRows(rows = [[""]]) {
  const source = Array.isArray(rows) && rows.length ? rows : [[""]];
  return source.map((row) => Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [""]);
}

export function declaredColumnCount(rows = []) {
  return Math.max(1, ...cloneCsvRows(rows).map((row) => row.length));
}

export function csvRenderDimensions(rows = [], activePosition = { row: 0, col: 0 }, extra = 1) {
  const safeRows = cloneCsvRows(rows);
  const activeRow = Math.max(0, Number.parseInt(activePosition?.row ?? 0, 10) || 0);
  const activeCol = Math.max(0, Number.parseInt(activePosition?.col ?? 0, 10) || 0);
  return {
    rows: Math.max(1, safeRows.length + extra, activeRow + extra + 1),
    cols: Math.max(1, declaredColumnCount(safeRows) + extra, activeCol + extra + 1),
  };
}

export function isDeclaredCsvCell(rows = [], rowIndex = 0, colIndex = 0) {
  const row = Array.isArray(rows?.[rowIndex]) ? rows[rowIndex] : null;
  return Boolean(row && colIndex >= 0 && colIndex < row.length);
}

export function ensureCsvCellMaterialized(rows = [], rowIndex = 0, colIndex = 0) {
  const safeRows = cloneCsvRows(rows);
  const targetRow = Math.max(0, Number.parseInt(rowIndex, 10) || 0);
  const targetCol = Math.max(0, Number.parseInt(colIndex, 10) || 0);
  while (safeRows.length <= targetRow) safeRows.push([]);
  while (safeRows[targetRow].length <= targetCol) safeRows[targetRow].push("");
  return safeRows;
}

export function setCsvCellValue(rows = [], rowIndex = 0, colIndex = 0, value = "") {
  const nextRows = ensureCsvCellMaterialized(rows, rowIndex, colIndex);
  nextRows[Math.max(0, rowIndex)][Math.max(0, colIndex)] = String(value ?? "");
  return nextRows;
}

export function insertCsvRow(rows = [], rowIndex = 0, width = null) {
  const nextRows = cloneCsvRows(rows);
  const insertAt = Math.max(0, Math.min(nextRows.length, Number.parseInt(rowIndex, 10) || 0));
  const columnCount = Math.max(1, Number.parseInt(width ?? declaredColumnCount(nextRows), 10) || 1);
  nextRows.splice(insertAt, 0, Array(columnCount).fill(""));
  return nextRows;
}

export function deleteCsvRow(rows = [], rowIndex = 0) {
  const nextRows = cloneCsvRows(rows);
  if (!nextRows.length) return [[""]];
  const removeAt = Math.max(0, Math.min(nextRows.length - 1, Number.parseInt(rowIndex, 10) || 0));
  nextRows.splice(removeAt, 1);
  return nextRows.length ? nextRows : [[""]];
}

export function insertCsvColumn(rows = [], colIndex = 0) {
  const nextRows = cloneCsvRows(rows);
  const insertAt = Math.max(0, Number.parseInt(colIndex, 10) || 0);
  return nextRows.map((row) => {
    const nextRow = [...row];
    while (nextRow.length < insertAt) nextRow.push("");
    nextRow.splice(insertAt, 0, "");
    return nextRow;
  });
}

export function deleteCsvColumn(rows = [], colIndex = 0) {
  const removeAt = Math.max(0, Number.parseInt(colIndex, 10) || 0);
  return cloneCsvRows(rows).map((row) => {
    const nextRow = [...row];
    if (nextRow.length > removeAt) nextRow.splice(removeAt, 1);
    return nextRow.length ? nextRow : [""];
  });
}

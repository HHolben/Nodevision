// Nodevision/ApplicationSystem/public/MetaWorld/Materials/MaterialCatalogCsv.mjs
// This module provides material catalog csv behavior shared by Nodevision world objects, equations, and voxels.

import { normalizeCatalogMaterialFile, normalizeWorldObjectMaterialId, normalizeWorldObjectMatterState } from './MaterialIdentity.mjs';

export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "");

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === "\"" && source[i + 1] === "\"") {
        cell += "\"";
        i += 1;
      } else if (ch === "\"") {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === "\"") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function rowsToObjects(rows) {
  const [headerRow, ...dataRows] = Array.isArray(rows) ? rows : [];
  const headers = Array.isArray(headerRow) ? headerRow.map((header) => String(header || "").trim()) : [];
  if (headers.length === 0) return [];
  return dataRows
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || "").trim()))
    .map((row) => {
      const out = {};
      headers.forEach((header, index) => {
        if (header) out[header] = String(row[index] || "").trim();
      });
      return out;
    });
}

export function readCsvField(row, names) {
  for (const name of names) {
    if (typeof row?.[name] === "string" && row[name].trim()) return row[name].trim();
  }
  const lowered = new Map(Object.entries(row || {}).map(([key, value]) => [key.toLowerCase(), value]));
  for (const name of names) {
    const value = lowered.get(String(name).toLowerCase());
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function normalizeCatalogEntry(row) {
  const materialName = readCsvField(row, ["MaterialName", "materialName", "name", "displayName"]);
  const materialJSONfile = readCsvField(row, ["MaterialJSONfile", "MaterialJSONFile", "materialJSONfile", "materialJsonFile", "file"]);
  const materialFile = normalizeCatalogMaterialFile(materialJSONfile);
  const materialId = normalizeWorldObjectMaterialId(materialFile, materialName);
  const matterState = normalizeWorldObjectMatterState(readCsvField(row, ["MatterState", "matterState", "stateOfMatter"]));
  return {
    materialName: materialName || materialId || materialJSONfile,
    materialJSONfile,
    materialFile,
    materialId,
    matterState,
  };
}

export function parseWorldObjectMaterialCsv(text) {
  return rowsToObjects(parseCsvRows(text))
    .map(normalizeCatalogEntry)
    .filter((entry) => entry.materialName && entry.materialFile);
}

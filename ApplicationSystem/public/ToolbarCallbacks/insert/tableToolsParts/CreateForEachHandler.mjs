// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableToolsParts/CreateForEachHandler.mjs
// This module implements create For Each Handler behavior for the tableTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { readCellSpan } from "./ReadCellSpan.mjs";

// Create For Each Handler operations.
export function createForEachHandler(owner) {
  return (row, rowIndex) => {
    owner.grid[rowIndex] = owner.grid[rowIndex] || [];
    let colIndex = 0;
    Array.from(row.cells || []).forEach(cell => {
      while (owner.grid[rowIndex][colIndex]) colIndex += 1;
      const rowSpan = readCellSpan(cell, "rowspan", rowIndex, owner.rows.length);
      const colSpan = readCellSpan(cell, "colspan", rowIndex, owner.rows.length);
      const origin = {
        cell,
        row,
        rowIndex,
        colIndex,
        rowSpan,
        colSpan
      };
      owner.origins.set(cell, origin);
      for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
        owner.grid[r] = owner.grid[r] || [];
        for (let c = colIndex; c < colIndex + colSpan; c += 1) {
          owner.grid[r][c] = origin;
        }
      }
      colIndex += colSpan;
    });
  };
}

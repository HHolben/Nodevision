// Nodevision/ApplicationSystem/public/callbackLoader.mjs
// This file defines browser-side callback Loader logic for the Nodevision UI. It renders interface components and handles user interactions.

const inlineCallbacks = {
  insert: {
    tableMergeCells: async () => {
      const mod = await import("/ToolbarCallbacks/insert/tableTools.mjs");
      if (!mod.mergeSelectedTableCells()) {
        alert("Select a rectangular range of table cells, or place the caret in a cell that can merge right or down.");
      }
    },
    tableMergeCellRight: async () => {
      const mod = await import("/ToolbarCallbacks/insert/tableTools.mjs");
      if (!mod.mergeActiveTableCell("right")) alert("This cell cannot merge with the cell to its right.");
    },
    tableMergeCellDown: async () => {
      const mod = await import("/ToolbarCallbacks/insert/tableTools.mjs");
      if (!mod.mergeActiveTableCell("down")) alert("This cell cannot merge with the cell below it.");
    },
    tableSplitCell: async () => {
      const mod = await import("/ToolbarCallbacks/insert/tableTools.mjs");
      if (!mod.splitCurrentTableCell()) alert("Select a merged table cell to split.");
    },
  },
};

export async function loadCallback(category, key) {
  const inline = inlineCallbacks[String(category || "").toLowerCase()]?.[key];
  if (typeof inline === "function") return inline;

  try {
    const path = `/ToolbarCallbacks/${category}/${key}.mjs`;
    const module = await import(path);
    if (module.default && typeof module.default === "function") {
      return module.default;
    } else {
      console.warn(`Callback file ${path} did not export a default function.`);
      return () => alert(`Callback not implemented properly: ${key}`);
    }
  } catch (err) {
    console.error(`Failed to load callback ${category}/${key}:`, err);
    return () => alert(`Callback not implemented: ${category}/${key}`);
  }
}

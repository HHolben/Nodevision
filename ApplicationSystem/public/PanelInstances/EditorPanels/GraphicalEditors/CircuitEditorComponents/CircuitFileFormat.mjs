// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitFileFormat.mjs
// This file defines load and save helpers for the native .nvcircuit.json format. This file keeps defaults merged so corrupted files do not crash the editor.

import { fetchText, saveText } from "../FamilyEditorCommon.mjs";
import { createDefaultDocument } from "./CircuitEditorState.mjs";

function mergeDefaults(parsed) {
  const base = createDefaultDocument();
  return {
    metadata: { ...base.metadata, ...(parsed.metadata || {}) },
    sheet: { ...base.sheet, ...(parsed.sheet || {}) },
    components: parsed.components || [],
    wires: parsed.wires || [],
    junctions: parsed.junctions || [],
    labels: parsed.labels || [],
    texts: parsed.texts || [],
  };
}

export async function loadCircuitFile(path) {
  if (!path) return createDefaultDocument();
  try {
    const text = await fetchText(path);
    const parsed = JSON.parse(text);
    return mergeDefaults(parsed);
  } catch (err) {
    console.warn("Circuit editor: failed to load file, using blank document", err);
    return createDefaultDocument();
  }
}

export async function saveCircuitFile(path, document) {
  const target = path || "Notebook/untitled.nvcircuit.json";
  const text = JSON.stringify(document, null, 2);
  await saveText(target, text);
}

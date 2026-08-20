// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/BrokenLinkPlaceholders.mjs
// This module provides source-backed helpers for Graph Manager broken-link placeholder nodes and target retargeting.
import {
  getRelativeNotebookReference,
  normalizeNotebookFilePath,
  toNotebookAssetUrl,
} from "../../../utils/notebookPath.mjs";
import {
  applyLinkRecordEdit,
  fetchNotebookText,
  saveNotebookText,
  scanFileForLinkRecords,
  setSelectedGraphLink,
} from "./LinkRecords.mjs";

function cleanPath(value = "") {
  return normalizeNotebookFilePath(value);
}

function encodeIdPart(value = "") {
  return encodeURIComponent(String(value || "")).replace(/%/g, "_");
}

function relativePath(fromFilePath = "", targetPath = "") {
  return getRelativeNotebookReference({ sourcePath: fromFilePath, targetPath });
}

export function brokenPlaceholderId(sourcePath = "", targetPath = "", recordIndex = 0) {
  return `placeholder:${encodeIdPart(cleanPath(sourcePath))}:${encodeIdPart(cleanPath(targetPath))}:${Number(recordIndex) || 0}`;
}

export function makeBrokenPlaceholderRecord(record, targetPath = "") {
  if (!record || typeof record !== "object") return null;
  return {
    ...record,
    isBrokenLink: true,
    targetKind: "placeholder",
    targetPath: cleanPath(targetPath || record.targetPath || record.targetRaw),
  };
}

export function replacementTargetForRecord(record, nextTargetPath = "") {
  const next = cleanPath(nextTargetPath);
  const raw = String(record?.targetRaw || "").trim();
  if (!next) return "";
  const absoluteNotebook = toNotebookAssetUrl(next);
  if (/^\/Notebook\//i.test(raw)) return absoluteNotebook;
  if (/^Notebook\//i.test(raw)) return absoluteNotebook.replace(/^\/+/, "");
  if (raw.startsWith("/")) return absoluteNotebook.replace(/^\/Notebook/i, "");
  const rel = relativePath(record?.sourcePath || "", next);
  if (raw.startsWith("./") && !rel.startsWith("../")) return `./${rel}`;
  return rel;
}

function samePath(a = "", b = "") {
  return cleanPath(a) === cleanPath(b);
}

function nextSelectionFromRecords(records, sourceRecord, previousSelection) {
  const updatedRecord = records.find((item) => item.recordIndex === sourceRecord.recordIndex) || records[0] || null;
  if (!updatedRecord) return null;
  return {
    edgeId: previousSelection?.edgeId || "",
    source: updatedRecord.sourcePath,
    target: updatedRecord.targetPath,
    occurrenceIndex: updatedRecord.recordIndex || 0,
    occurrenceCount: records.length,
    occurrences: records,
    record: updatedRecord,
  };
}

export async function retargetGraphLinkRecord(record, nextTargetPath, options = {}) {
  if (!record?.sourcePath) throw new Error("No source file is associated with this link.");
  if (!record.editableTarget) throw new Error("This link has no editable target span in its source file.");
  if (typeof window !== "undefined" && window.__nvCodeEditorDirty && samePath(window.__nvCodeEditorActivePath, record.sourcePath)) {
    throw new Error("Save or close the dirty source editor before editing this link.");
  }

  const loaded = await fetchNotebookText(record.sourcePath);
  if (loaded.isBinary) throw new Error("Refusing to edit a binary-looking source file.");

  const targetRaw = replacementTargetForRecord(record, nextTargetPath);
  const result = applyLinkRecordEdit(loaded.content, record, { targetRaw });
  if (!result.changed) return { changed: false, selection: options.selection || null };

  await saveNotebookText({
    path: record.sourcePath,
    content: result.content,
    encoding: loaded.encoding,
    bom: loaded.bom,
  });

  const records = await scanFileForLinkRecords(record.sourcePath);
  const selection = nextSelectionFromRecords(records, result.updatedRecord || record, options.selection || null);
  setSelectedGraphLink(selection);
  return { changed: true, selection, targetRaw };
}

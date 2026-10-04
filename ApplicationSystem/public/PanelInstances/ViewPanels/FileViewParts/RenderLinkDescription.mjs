// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/RenderLinkDescription.mjs
// This module implements render Link Description behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { summarizeLinkRecord, listToCsv, normalizeSymbols, csvToList, selectedGraphLink, fetchNotebookText, applyLinkRecordEdit, saveNotebookText, scanFileForLinkRecords, setSelectedGraphLink } from "/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.mjs";
import { linkTargetDisplay, detailLine, setLinkViewStatus, canEditLinkRecord } from "./RenderCreateIndexButton.mjs";
import { FileViewModuleState } from "./CancelScheduledSelectedFileViewRender.mjs";
import { sameNotebookPath } from "./RetainFileViewSelectionFollower.mjs";

// Render Link Description operations.
export function renderLinkDescription(shell, selection) {
  const record = selection?.record || {};
  const section = document.createElement("section");
  section.className = "nv-link-file-section";
  const title = document.createElement("h3");
  title.textContent = "Link Attributes";
  section.appendChild(title);
  const grid = document.createElement("div");
  grid.className = "nv-link-file-details";
  const rows = [["Summary", summarizeLinkRecord(record)], ["Edge", selection?.edgeId || ""], ["Occurrence", String((Number(selection?.occurrenceIndex) || 0) + 1) + " of " + String(selection?.occurrenceCount || 1)], ["Record ID", record.id || ""], ["Record Index", record.recordIndex ?? ""], ["Source Format", record.sourceFormat || ""], ["Type", record.linkKind || ""], ["Property", record.linkProperty || ""], ["Scope", record.targetKind || ""], ["Source", record.sourcePath || ""], ["Resolved Target", linkTargetDisplay(record)], ["Raw Target", record.targetRaw || ""], ["Link Text", record.linkText || ""], ["Label", record.label || record.displayText || ""], ["Tags", listToCsv(record.tags || [])], ["Symbols", normalizeSymbols(record.symbols || []).join(" ")], ["Editable Target", record.editableTarget ? "Yes" : "No"], ["Editable Text", record.editableText ? "Yes" : "No"], ["Editable Metadata", record.editableMetadata ? "Yes" : "No"]];
  rows.forEach(([label, value]) => grid.appendChild(detailLine(label, value)));
  section.appendChild(grid);
  shell.appendChild(section);
}

export function readLinkPatchFromForm(root) {
  const label = root.querySelector("#nv-link-file-label")?.value || "";
  return {
    targetRaw: root.querySelector("#nv-link-file-target")?.value || "",
    linkText: root.querySelector("#nv-link-file-text")?.value || "",
    tags: csvToList(root.querySelector("#nv-link-file-tags")?.value || ""),
    symbols: normalizeSymbols(root.querySelector("#nv-link-file-symbols")?.value || ""),
    label,
    displayText: label
  };
}

export function nextLinkSelectionFromRecords(records, sourceRecord, selection) {
  const updatedRecord = records.find(item => item.recordIndex === sourceRecord.recordIndex) || records[0] || null;
  if (!updatedRecord) return null;
  return {
    edgeId: selection?.edgeId || "",
    source: updatedRecord.sourcePath,
    target: updatedRecord.targetPath,
    occurrenceIndex: updatedRecord.recordIndex || 0,
    occurrenceCount: records.length,
    occurrences: records,
    record: updatedRecord
  };
}

export async function saveLinkViewEdit(root) {
  const selection = FileViewModuleState.currentLinkViewSelection || selectedGraphLink();
  const record = selection?.record || null;
  if (!record?.sourcePath) {
    setLinkViewStatus(root, "No link selected.", "warn");
    return;
  }
  if (!canEditLinkRecord(record)) {
    setLinkViewStatus(root, "This link has no editable source span.", "warn");
    return;
  }
  setLinkViewStatus(root, "Saving...", "");
  try {
    if (window.__nvCodeEditorDirty && sameNotebookPath(window.__nvCodeEditorActivePath, record.sourcePath)) {
      throw new Error("Save or close the dirty source editor before editing this link.");
    }
    const loaded = await fetchNotebookText(record.sourcePath);
    if (loaded.isBinary) {
      throw new Error("Refusing to edit a binary-looking source file.");
    }
    const result = applyLinkRecordEdit(loaded.content, record, readLinkPatchFromForm(root));
    if (!result.changed) {
      setLinkViewStatus(root, "No changes to save.", "warn");
      return;
    }
    await saveNotebookText({
      path: record.sourcePath,
      content: result.content,
      encoding: loaded.encoding,
      bom: loaded.bom
    });
    const records = await scanFileForLinkRecords(record.sourcePath);
    const next = nextLinkSelectionFromRecords(records, result.updatedRecord || record, selection);
    setSelectedGraphLink(next);
    if (typeof window.refreshGraphManager === "function") {
      await window.refreshGraphManager({
        fit: false,
        reason: "link-file-view-edit"
      });
    }
    setLinkViewStatus(root, "Saved", "ok");
  } catch (err) {
    console.error("[FileView] Link edit failed:", err);
    setLinkViewStatus(root, err?.message || "Save failed", "error");
  }
}

export async function refreshLinkViewRecord(root) {
  const selection = FileViewModuleState.currentLinkViewSelection || selectedGraphLink();
  const record = selection?.record || null;
  if (!record?.sourcePath) return;
  setLinkViewStatus(root, "Refreshing...", "");
  const records = await scanFileForLinkRecords(record.sourcePath);
  const next = nextLinkSelectionFromRecords(records, record, selection);
  setSelectedGraphLink(next);
  setLinkViewStatus(root, next ? "Refreshed" : "No links found in source", next ? "ok" : "warn");
}

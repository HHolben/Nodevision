// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/RenderCreateIndexButton.mjs
// This module implements render Create Index Button behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeResolvedNotebookPath } from "./RetainFileViewSelectionFollower.mjs";
import { notebookIndexPathForDirectory } from "./SelectLinkedPathInFileView.mjs";
import { prepareViewPanelForInlineState } from "./NotebookFileExists.mjs";
import { setFileViewStatus } from "./GetViewPanelElement.mjs";
import { createProceedHandler } from "./RenderFile.mjs";
import { guardFileSwitch } from "/EditorSwitchGuard.mjs";
import { setSelectedGraphLink } from "/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.mjs";

// Render Create Index Button operations.
export function renderCreateIndexButton(viewPanel, directoryPath = "", options = {}) {
  if (!viewPanel) return false;
  const cleanDirectory = normalizeResolvedNotebookPath(directoryPath || "");
  const indexPath = notebookIndexPathForDirectory(cleanDirectory);
  const selectCreatedFile = options.selectCreatedFile !== false;
  prepareViewPanelForInlineState(viewPanel);
  const style = document.createElement("style");
  style.textContent = [".nv-create-index-shell{min-height:100%;display:grid;place-items:center;padding:16px;box-sizing:border-box;background:#f8fafc}", ".nv-create-index-btn{appearance:none;border:1px solid #1d4ed8;border-radius:6px;background:#1f6feb;color:#fff;font:600 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:9px 14px;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.16)}", ".nv-create-index-btn:hover:not(:disabled){background:#1a5fd0}", ".nv-create-index-btn:disabled{opacity:.65;cursor:wait}"].join("\n");
  const shell = document.createElement("div");
  shell.className = "nv-create-index-shell";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nv-create-index-btn";
  button.textContent = "Create index.html";
  shell.appendChild(button);
  viewPanel.append(style, shell);
  setFileViewStatus("File Viewer", "Missing: " + indexPath);
  button.addEventListener("click", () => {
    const proceed = createProceedHandler({
      get button() {
        return button;
      },
      get indexPath() {
        return indexPath;
      },
      get cleanDirectory() {
        return cleanDirectory;
      },
      get selectCreatedFile() {
        return selectCreatedFile;
      }
    });
    if (typeof guardFileSwitch === "function") {
      guardFileSwitch(indexPath, proceed);
    } else {
      proceed();
    }
  });
  return true;
}

export function linkTargetDisplay(record = {}) {
  return record.targetKind === "external" ? record.targetRaw || record.targetPath || "" : record.targetPath || record.targetRaw || "";
}

export function canEditLinkRecord(record = {}) {
  return Boolean(record.editableTarget || record.editableText || record.editableMetadata);
}

export function makeLinkViewButton(label, role = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nv-link-file-btn";
  button.textContent = label;
  if (role) button.dataset.role = role;
  return button;
}

export function setLinkViewStatus(root, message, kind = "") {
  const status = root?.querySelector?.("[data-role=\"link-status\"]");
  if (!status) return;
  status.textContent = message || "";
  status.dataset.kind = kind;
}

export function detailLine(label, value) {
  const row = document.createElement("div");
  row.className = "nv-link-file-detail-row";
  const labelEl = document.createElement("div");
  labelEl.className = "nv-link-file-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("div");
  valueEl.className = "nv-link-file-value";
  valueEl.textContent = value === undefined || value === null || value === "" ? "None" : String(value);
  row.append(labelEl, valueEl);
  return row;
}

export function fieldNode({
  id,
  label,
  value = "",
  disabled = false,
  placeholder = ""
}) {
  const field = document.createElement("label");
  field.className = "nv-link-file-field";
  field.htmlFor = id;
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.id = id;
  input.value = value || "";
  input.placeholder = placeholder || "";
  input.disabled = Boolean(disabled);
  field.append(span, input);
  return field;
}

export function occurrenceLabelForLink(record, index) {
  const type = record?.linkProperty || record?.linkKind || "link";
  const target = record?.targetRaw || record?.targetPath || "";
  return String(index + 1) + ". " + type + " - " + target;
}

export function renderLinkOccurrenceSelector(shell, selection) {
  const occurrences = Array.isArray(selection?.occurrences) ? selection.occurrences : [];
  if (occurrences.length <= 1) return;
  const select = document.createElement("select");
  select.className = "nv-link-file-select";
  select.setAttribute("aria-label", "Link occurrence");
  occurrences.forEach((occurrence, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = occurrenceLabelForLink(occurrence, index);
    option.selected = index === selection.occurrenceIndex;
    select.appendChild(option);
  });
  select.addEventListener("change", () => {
    const index = Number(select.value) || 0;
    setSelectedGraphLink({
      ...selection,
      occurrenceIndex: index,
      record: occurrences[index] || occurrences[0] || null
    });
  });
  shell.appendChild(select);
}

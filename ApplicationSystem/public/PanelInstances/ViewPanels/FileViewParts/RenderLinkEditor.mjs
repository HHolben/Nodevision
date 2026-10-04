// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/RenderLinkEditor.mjs
// This module implements render Link Editor behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { canEditLinkRecord, fieldNode, makeLinkViewButton } from "./RenderCreateIndexButton.mjs";
import { listToCsv, normalizeSymbols, fetchNotebookText } from "/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.mjs";
import { saveLinkViewEdit, refreshLinkViewRecord } from "./RenderLinkDescription.mjs";
import { normalizeResolvedNotebookPath } from "./RetainFileViewSelectionFollower.mjs";

// Render Link Editor operations.
export function renderLinkEditor(shell, selection) {
  const record = selection?.record || {};
  const canEdit = canEditLinkRecord(record);
  const section = document.createElement("section");
  section.className = "nv-link-file-section";
  const title = document.createElement("h3");
  title.textContent = "Link Editor";
  section.appendChild(title);
  const form = document.createElement("form");
  form.className = "nv-link-file-editor";
  form.append(fieldNode({
    id: "nv-link-file-target",
    label: "Link Target",
    value: record.targetRaw || "",
    disabled: !record.editableTarget
  }), fieldNode({
    id: "nv-link-file-text",
    label: "Link Text",
    value: record.linkText || "",
    disabled: !record.editableText
  }), fieldNode({
    id: "nv-link-file-tags",
    label: "Tags",
    value: listToCsv(record.tags || []),
    disabled: !record.editableMetadata,
    placeholder: "reference, draft"
  }), fieldNode({
    id: "nv-link-file-symbols",
    label: "Symbols",
    value: normalizeSymbols(record.symbols || []).join(" "),
    disabled: !record.editableMetadata,
    placeholder: "*, ?"
  }), fieldNode({
    id: "nv-link-file-label",
    label: "Label",
    value: record.label || record.displayText || "",
    disabled: !record.editableMetadata
  }));
  const actions = document.createElement("div");
  actions.className = "nv-link-file-actions";
  const saveBtn = makeLinkViewButton("Save Link", "save-link");
  saveBtn.className = "nv-link-file-btn nv-link-file-primary";
  saveBtn.type = "submit";
  saveBtn.disabled = !canEdit;
  const refreshBtn = makeLinkViewButton("Refresh", "refresh-link");
  const sourceBtn = makeLinkViewButton("Open Source", "open-source");
  const targetBtn = makeLinkViewButton("Open Target", "open-target");
  if (record.targetKind === "external") targetBtn.textContent = "Open External";
  actions.append(saveBtn, refreshBtn, sourceBtn, targetBtn);
  form.appendChild(actions);
  const status = document.createElement("div");
  status.className = "nv-link-file-status";
  status.dataset.role = "link-status";
  status.textContent = canEdit ? "" : "This link has no editable source span yet.";
  form.appendChild(status);
  form.addEventListener("submit", event => {
    event.preventDefault();
    saveLinkViewEdit(section);
  });
  refreshBtn.addEventListener("click", () => refreshLinkViewRecord(section));
  sourceBtn.addEventListener("click", () => {
    if (record.sourcePath) window.selectedFilePath = record.sourcePath;
  });
  targetBtn.addEventListener("click", () => {
    if (record.targetKind === "external" && record.targetRaw) {
      window.open(record.targetRaw, "_blank", "noopener");
      return;
    }
    const targetPath = normalizeResolvedNotebookPath(record.targetPath || record.targetRaw || "");
    if (targetPath) window.selectedFilePath = targetPath;
  });
  section.appendChild(form);
  shell.appendChild(section);
}

export function appendHighlightedText(pre, content, highlights = []) {
  const text = String(content || "");
  const cleanHighlights = highlights.filter(item => item && Number.isFinite(item.start) && Number.isFinite(item.end) && item.start < item.end).map(item => ({
    ...item,
    start: Math.max(0, item.start),
    end: Math.min(text.length, item.end)
  })).filter(item => item.start < item.end).sort((a, b) => a.start - b.start);
  let offset = 0;
  cleanHighlights.forEach(item => {
    if (item.start < offset) return;
    if (item.start > offset) pre.appendChild(document.createTextNode(text.slice(offset, item.start)));
    const span = document.createElement("span");
    span.className = "nv-link-file-highlight nv-link-file-highlight-" + item.kind;
    span.textContent = text.slice(item.start, item.end);
    pre.appendChild(span);
    offset = item.end;
  });
  if (offset < text.length) pre.appendChild(document.createTextNode(text.slice(offset)));
}

export async function renderSourcePreview(body, record) {
  if (!record?.sourcePath) {
    body.textContent = "No source file recorded.";
    return;
  }
  try {
    const loaded = await fetchNotebookText(record.sourcePath);
    if (loaded.isBinary) {
      body.textContent = "Source file appears to be binary and cannot be shown as text.";
      return;
    }
    body.innerHTML = "";
    const pre = document.createElement("pre");
    pre.className = "nv-link-file-code";
    appendHighlightedText(pre, loaded.content, [{
      ...(record.ranges?.text || {}),
      kind: "text"
    }, {
      ...(record.ranges?.target || {}),
      kind: "target"
    }]);
    body.appendChild(pre);
  } catch (err) {
    body.textContent = err?.message || "Failed to load source file.";
  }
}

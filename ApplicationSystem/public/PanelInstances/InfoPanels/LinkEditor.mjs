// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/LinkEditor.mjs
// Dedicated source-backed editor for Graph Manager link selections.

import {
  applyLinkRecordEdit,
  csvToList,
  fetchNotebookText,
  listToCsv,
  normalizeSymbols,
  saveNotebookText,
  scanFileForLinkRecords,
  selectedGraphLink,
  setSelectedGraphLink,
} from "./GraphManagerDependencies/LinkRecords.mjs";

let rootEl = null;
let currentSelection = null;

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function field({ id, label, value = "", disabled = false, placeholder = "" }) {
  return `
    <label class="nv-link-field" for="${id}">
      <span>${escapeHtml(label)}</span>
      <input id="${id}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${disabled ? " disabled" : ""}>
    </label>
  `;
}

function setStatus(message, kind = "") {
  const status = rootEl?.querySelector?.("[data-role=\"status\"]");
  if (!status) return;
  status.textContent = message || "";
  status.dataset.kind = kind;
}

function occurrenceLabel(record, index) {
  const type = record?.linkProperty || record?.linkKind || "link";
  const target = record?.targetRaw || record?.targetPath || "";
  return `${index + 1}. ${type} - ${target}`;
}

function renderEmpty() {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <style>${panelCss()}</style>
    <div class="nv-link-editor">
      <div class="nv-link-title">Link Editor</div>
      <div class="nv-link-empty">Select an edge in Graph Manager.</div>
    </div>
  `;
}

function renderSelection(selection) {
  if (!rootEl) return;
  currentSelection = selection || null;
  const record = selection?.record || null;
  if (!record) {
    renderEmpty();
    return;
  }

  const occurrences = Array.isArray(selection.occurrences) ? selection.occurrences : [record];
  const canEdit = record.editableTarget || record.editableText || record.editableMetadata;
  const selector = occurrences.length > 1
    ? `<select class="nv-link-select" data-role="occurrence">${occurrences.map((item, index) => {
        const selected = index === selection.occurrenceIndex ? " selected" : "";
        return `<option value="${index}"${selected}>${escapeHtml(occurrenceLabel(item, index))}</option>`;
      }).join("")}</select>`
    : "";

  rootEl.innerHTML = `
    <style>${panelCss()}</style>
    <form class="nv-link-editor" data-role="form">
      <div class="nv-link-header">
        <div>
          <div class="nv-link-title">Link Editor</div>
          <div class="nv-link-subtitle">${escapeHtml(record.sourcePath)}</div>
        </div>
        <button class="nv-link-btn" type="button" data-role="open-source">Source</button>
      </div>
      ${selector}
      <div class="nv-link-meta">
        <span>${escapeHtml(record.linkKind || "link")}</span>
        <span>${escapeHtml(record.linkProperty || "")}</span>
        <span>${escapeHtml(record.targetKind || "")}</span>
      </div>
      ${field({ id: "nv-link-target", label: "Link Target", value: record.targetRaw, disabled: !record.editableTarget })}
      ${field({ id: "nv-link-text", label: "Link Text", value: record.linkText, disabled: !record.editableText })}
      ${field({ id: "nv-link-tags", label: "Tags", value: listToCsv(record.tags), disabled: !record.editableMetadata, placeholder: "reference, draft" })}
      ${field({ id: "nv-link-symbols", label: "Symbols", value: normalizeSymbols(record.symbols).join(" "), disabled: !record.editableMetadata, placeholder: "*, ?" })}
      ${field({ id: "nv-link-display", label: "Graph Text", value: record.displayText, disabled: !record.editableMetadata })}
      <div class="nv-link-actions">
        <button class="nv-link-primary" type="submit"${canEdit ? "" : " disabled"}>Save Link</button>
        <button class="nv-link-btn" type="button" data-role="refresh">Refresh</button>
      </div>
      <div class="nv-link-status" data-role="status">${canEdit ? "" : "This link has no editable source span yet."}</div>
    </form>
  `;

  rootEl.querySelector("[data-role=\"occurrence\"]")?.addEventListener("change", (evt) => {
    const index = Number(evt.target.value) || 0;
    const next = {
      ...currentSelection,
      occurrenceIndex: index,
      record: occurrences[index] || occurrences[0] || null,
    };
    setSelectedGraphLink(next);
  });

  rootEl.querySelector("[data-role=\"open-source\"]")?.addEventListener("click", () => {
    if (record.sourcePath) {
      window.selectedFilePath = record.sourcePath;
      if (typeof window.openCodeEditor === "function") {
        window.openCodeEditor(record.sourcePath);
      }
    }
  });

  rootEl.querySelector("[data-role=\"refresh\"]")?.addEventListener("click", async () => {
    await refreshSelectedSource(record);
  });

  rootEl.querySelector("[data-role=\"form\"]")?.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    await saveCurrentEdit();
  });
}


function samePath(a = "", b = "") {
  const clean = (value) => String(value || "").replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^\/+/, "").replace(/^Notebook\//i, "");
  return clean(a) === clean(b);
}

function readPatchFromForm() {
  return {
    targetRaw: rootEl.querySelector("#nv-link-target")?.value || "",
    linkText: rootEl.querySelector("#nv-link-text")?.value || "",
    tags: csvToList(rootEl.querySelector("#nv-link-tags")?.value || ""),
    symbols: normalizeSymbols(rootEl.querySelector("#nv-link-symbols")?.value || ""),
    displayText: rootEl.querySelector("#nv-link-display")?.value || "",
  };
}

async function refreshSelectedSource(record) {
  if (!record?.sourcePath) return;
  setStatus("Refreshing...", "");
  const records = await scanFileForLinkRecords(record.sourcePath);
  const nextRecord = records.find((item) => item.recordIndex === record.recordIndex) || records[0] || null;
  const next = nextRecord
    ? {
        edgeId: currentSelection?.edgeId || "",
        source: nextRecord.sourcePath,
        target: nextRecord.targetPath,
        occurrenceIndex: nextRecord.recordIndex || 0,
        occurrenceCount: records.length,
        occurrences: records,
        record: nextRecord,
      }
    : null;
  setSelectedGraphLink(next);
  setStatus(nextRecord ? "Refreshed" : "No links found in source", nextRecord ? "ok" : "warn");
}

async function saveCurrentEdit() {
  const record = currentSelection?.record || null;
  if (!record?.sourcePath) {
    setStatus("No link selected.", "warn");
    return;
  }
  if (!record.editableTarget && !record.editableText && !record.editableMetadata) {
    setStatus("This link cannot be edited from the current edge record.", "warn");
    return;
  }

  setStatus("Saving...", "");
  try {
    if (window.__nvCodeEditorDirty && samePath(window.__nvCodeEditorActivePath, record.sourcePath)) {
      throw new Error("Save or close the dirty source editor before editing this link.");
    }
    const loaded = await fetchNotebookText(record.sourcePath);
    if (loaded.isBinary) {
      throw new Error("Refusing to edit a binary-looking source file.");
    }

    const result = applyLinkRecordEdit(loaded.content, record, readPatchFromForm());
    if (!result.changed) {
      setStatus("No changes to save.", "warn");
      return;
    }

    await saveNotebookText({
      path: record.sourcePath,
      content: result.content,
      encoding: loaded.encoding,
      bom: loaded.bom,
    });

    const records = await scanFileForLinkRecords(record.sourcePath);
    const updatedRecord =
      records.find((item) => item.recordIndex === record.recordIndex) ||
      result.updatedRecord ||
      records[0] ||
      null;

    if (updatedRecord) {
      setSelectedGraphLink({
        edgeId: currentSelection?.edgeId || "",
        source: updatedRecord.sourcePath,
        target: updatedRecord.targetPath,
        occurrenceIndex: updatedRecord.recordIndex || 0,
        occurrenceCount: records.length,
        occurrences: records,
        record: updatedRecord,
      });
    }

    if (typeof window.refreshGraphManager === "function") {
      await window.refreshGraphManager({ fit: false, reason: "link-edit" });
    }
    setStatus("Saved", "ok");
  } catch (err) {
    console.error("[LinkEditor] Save failed:", err);
    setStatus(err?.message || "Save failed", "error");
  }
}

function panelCss() {
  return `
    .nv-link-editor {
      display: flex;
      flex-direction: column;
      gap: 11px;
      min-height: 100%;
      color: #172033;
      font: 13px system-ui, sans-serif;
    }
    .nv-link-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid #d8dee9;
      padding-bottom: 8px;
    }
    .nv-link-title {
      font-size: 15px;
      font-weight: 700;
    }
    .nv-link-subtitle,
    .nv-link-empty {
      color: #64748b;
      overflow-wrap: anywhere;
    }
    .nv-link-select,
    .nv-link-field input,
    .nv-link-btn,
    .nv-link-primary {
      font: inherit;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
    }
    .nv-link-select,
    .nv-link-field input {
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
      padding: 7px 8px;
      background: #ffffff;
      color: #172033;
    }
    .nv-link-field {
      display: grid;
      gap: 5px;
      font-weight: 650;
      color: #475569;
    }
    .nv-link-field input:disabled {
      color: #64748b;
      background: #f1f5f9;
    }
    .nv-link-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .nv-link-meta span {
      border: 1px solid #d8dee9;
      background: #f8fafc;
      border-radius: 6px;
      padding: 2px 6px;
      color: #475569;
    }
    .nv-link-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
    }
    .nv-link-btn,
    .nv-link-primary {
      padding: 6px 10px;
      cursor: pointer;
    }
    .nv-link-btn {
      background: #ffffff;
      color: #172033;
    }
    .nv-link-primary {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
    }
    .nv-link-primary:disabled {
      cursor: default;
      background: #94a3b8;
      border-color: #94a3b8;
    }
    .nv-link-status {
      min-height: 18px;
      color: #64748b;
      overflow-wrap: anywhere;
    }
    .nv-link-status[data-kind="ok"] {
      color: #047857;
    }
    .nv-link-status[data-kind="warn"] {
      color: #9a5800;
    }
    .nv-link-status[data-kind="error"] {
      color: #b91c1c;
    }
  `;
}

export function updateLinkEditorPanel(selection = selectedGraphLink()) {
  renderSelection(selection);
}

export async function setupPanel(panelElem) {
  rootEl = panelElem;
  rootEl.style.height = "100%";
  rootEl.style.overflow = "auto";
  window.updateLinkEditorPanel = updateLinkEditorPanel;
  window.addEventListener("nodevision-graph-link-selected", (evt) => {
    updateLinkEditorPanel(evt.detail?.selection || null);
  });
  updateLinkEditorPanel(selectedGraphLink());
}


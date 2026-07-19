// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/LinkViewer.mjs
// Dedicated read-only viewer for Graph Manager link selections.

import { selectedGraphLink, setSelectedGraphLink, summarizeLinkRecord } from "./GraphManagerDependencies/LinkRecords.mjs";

let rootEl = null;
let currentSelection = null;

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function chipList(items = [], empty = "None") {
  const list = asList(items).map((item) => String(item || "").trim()).filter(Boolean);
  if (!list.length) return `<span class="nv-link-muted">${escapeHtml(empty)}</span>`;
  return list.map((item) => `<span class="nv-link-chip">${escapeHtml(item)}</span>`).join("");
}

function detailRow(label, value) {
  const clean = String(value || "").trim();
  return `
    <div class="nv-link-row">
      <div class="nv-link-label">${escapeHtml(label)}</div>
      <div class="nv-link-value">${clean ? escapeHtml(clean) : "<span class=\"nv-link-muted\">None</span>"}</div>
    </div>
  `;
}

function occurrenceLabel(record, index) {
  const type = record?.linkProperty || record?.linkKind || "link";
  return `${index + 1}. ${type} - ${summarizeLinkRecord(record)}`;
}

function renderEmpty() {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <style>${panelCss()}</style>
    <div class="nv-link-panel">
      <div class="nv-link-title">Link Viewer</div>
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
  const target = record.targetKind === "external" ? record.targetRaw : record.targetPath;
  const selector = occurrences.length > 1
    ? `<select class="nv-link-select" data-role="occurrence">${occurrences.map((item, index) => {
        const selected = index === selection.occurrenceIndex ? " selected" : "";
        return `<option value="${index}"${selected}>${escapeHtml(occurrenceLabel(item, index))}</option>`;
      }).join("")}</select>`
    : "";

  rootEl.innerHTML = `
    <style>${panelCss()}</style>
    <div class="nv-link-panel">
      <div class="nv-link-header">
        <div>
          <div class="nv-link-title">Link Viewer</div>
          <div class="nv-link-subtitle">${escapeHtml(summarizeLinkRecord(record))}</div>
        </div>
        <button class="nv-link-btn" type="button" data-role="edit">Edit</button>
      </div>
      ${selector}
      <div class="nv-link-section">
        ${detailRow("Type", record.linkKind)}
        ${detailRow("Property", record.linkProperty)}
        ${detailRow("Scope", record.targetKind)}
        ${detailRow("Source", record.sourcePath)}
        ${detailRow("Target", target)}
        ${detailRow("Raw Link", record.targetRaw)}
        ${detailRow("Link Text", record.linkText)}
        ${detailRow("Graph Text", record.displayText)}
      </div>
      <div class="nv-link-section">
        <div class="nv-link-label">Tags</div>
        <div class="nv-link-chips">${chipList(record.tags)}</div>
        <div class="nv-link-label nv-link-label-spaced">Symbols</div>
        <div class="nv-link-chips">${chipList(record.symbols)}</div>
      </div>
      <div class="nv-link-foot">
        ${record.editableTarget ? "Editable source link" : "Scanned/persisted link only"}
      </div>
    </div>
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

  rootEl.querySelector("[data-role=\"edit\"]")?.addEventListener("click", () => {
    if (typeof window.openLinkEditorPanel === "function") {
      window.openLinkEditorPanel();
    }
  });
}

function panelCss() {
  return `
    .nv-link-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
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
    .nv-link-muted,
    .nv-link-foot {
      color: #64748b;
    }
    .nv-link-section {
      display: grid;
      gap: 8px;
    }
    .nv-link-row {
      display: grid;
      grid-template-columns: minmax(88px, 0.34fr) minmax(0, 1fr);
      gap: 10px;
      align-items: start;
    }
    .nv-link-label {
      color: #475569;
      font-weight: 650;
    }
    .nv-link-label-spaced {
      margin-top: 4px;
    }
    .nv-link-value {
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .nv-link-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .nv-link-chip {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      border-radius: 6px;
      padding: 2px 6px;
    }
    .nv-link-select,
    .nv-link-btn {
      font: inherit;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #172033;
      border-radius: 6px;
    }
    .nv-link-select {
      width: 100%;
      padding: 6px 8px;
    }
    .nv-link-btn {
      padding: 5px 9px;
      cursor: pointer;
    }
    .nv-link-empty {
      color: #64748b;
      padding: 8px 0;
    }
    .nv-link-foot {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 12px;
    }
  `;
}

export function updateLinkViewerPanel(selection = selectedGraphLink()) {
  renderSelection(selection);
}

export async function setupPanel(panelElem) {
  rootEl = panelElem;
  rootEl.style.height = "100%";
  rootEl.style.overflow = "auto";
  window.updateLinkViewerPanel = updateLinkViewerPanel;
  window.addEventListener("nodevision-graph-link-selected", (evt) => {
    updateLinkViewerPanel(evt.detail?.selection || null);
  });
  updateLinkViewerPanel(selectedGraphLink());
}


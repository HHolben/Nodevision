// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/PhoneImportPanel.mjs
// Browser panel for the Import from Phone MVP.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";

const navigationState = getNodevisionNavigationState();
const ACK_KEY = "nodevision.phoneImport.privacyAcknowledged";
const POLL_MS = 650;

const TEMPLATE = `
  <div class="nv-phone-import" data-phone-import-root>
    <div class="nv-phone-import-panel-row" style="justify-content:space-between;align-items:flex-start;">
      <div>
        <h3>Phone Import</h3>
      </div>
      <button type="button" data-refresh-status>Refresh</button>
    </div>

    <section class="nv-phone-import-source">
      <label><input type="radio" name="phone-import-source" checked> <span>Existing iPhone Backup</span></label>
      <label><input type="radio" name="phone-import-source" disabled> <span>Connected iPhone - Coming later</span></label>
    </section>

    <div class="nv-phone-import-panel-row">
      <label style="flex:1;min-width:260px;">Backup directory
        <input type="text" data-backup-path placeholder="/path/to/iPhone backup">
      </label>
      <button type="button" data-scan data-primary>Scan Backup</button>
      <button type="button" data-cancel disabled>Cancel</button>
    </div>

    <div class="nv-phone-import-status" data-status data-tone="neutral">No backup selected</div>

    <section class="nv-phone-import-preview" data-preview>
      <div class="nv-phone-import-summary" data-summary></div>
      <div class="nv-phone-import-controls">
        <button type="button" data-select-all>Select all</button>
        <button type="button" data-select-none>Select none</button>
        <label style="min-width:210px;flex:1;">Search
          <input type="search" data-filter placeholder="Filter conversations">
        </label>
        <label>Sort
          <select data-sort>
            <option value="recent">Recent activity</option>
            <option value="messages">Message count</option>
            <option value="title">Participant/title</option>
          </select>
        </label>
      </div>
      <div class="nv-phone-import-table-wrap">
        <table class="nv-phone-import-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Conversation</th>
              <th>Participants</th>
              <th>Messages</th>
              <th>Attachments</th>
              <th>First</th>
              <th>Last</th>
            </tr>
          </thead>
          <tbody data-conversation-list></tbody>
        </table>
      </div>
      <div class="nv-phone-import-warnings">
        <div>Phone backups may contain highly private information. Imported conversations and attachments will become ordinary files in your Nodevision Notebook. Review the destination and synchronization settings before continuing.</div>
        <div style="margin-top:6px;">Messages synchronized only through iCloud may not be present in this backup.</div>
        <label style="margin-top:8px;"><input type="checkbox" data-acknowledge> <span>I acknowledge this warning.</span></label>
      </div>
      <div class="nv-phone-import-panel-row">
        <label style="flex:1;min-width:240px;">Import destination
          <input type="text" data-destination value="/Notebook/Imports/Phones">
        </label>
        <label style="padding-bottom:7px;"><input type="checkbox" data-copy-attachments checked> <span>Copy attachments</span></label>
        <button type="button" data-import data-primary disabled>Import Selected</button>
      </div>
      <div data-result-links></div>
    </section>

    <details data-technical-details>
      <summary>Technical Details</summary>
      <pre data-details-output>{}</pre>
    </details>
  </div>
`;

function ensureStylesheet() {
  const href = "/PanelInstances/InfoPanels/PhoneImportPanel.css";
  if (document.querySelector('link[href="' + href + '"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso) {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function notebookUrl(relativePath = "") {
  const clean = String(relativePath || "").replace(/^\/+/, "").replace(/^Notebook\//i, "");
  return "/Notebook/" + clean.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

async function postJson(url, body = {}) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload?.error || "Request failed");
    err.payload = payload;
    err.status = res.status;
    throw err;
  }
  return payload;
}

async function getJson(url) {
  const res = await fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload?.error || "Request failed");
    err.payload = payload;
    err.status = res.status;
    throw err;
  }
  return payload;
}

function stateMessage(state, fallback = "") {
  const messages = {
    no_backup_selected: "No backup selected",
    scanning_backup: "Scanning backup",
    invalid_backup_directory: "Invalid backup directory",
    encrypted_backup_not_supported: "This backup is encrypted. Encrypted iPhone backups are not supported by this version of the importer.",
    messages_database_not_found: "Messages database not found",
    messages_database_found: "Messages database found",
    reading_conversations: "Reading conversations",
    ready_to_import: "Ready to import",
    importing: "Importing",
    import_completed: "Import completed",
    import_completed_with_warnings: "Import completed with warnings",
    import_failed: "Import failed",
  };
  return messages[state] || fallback || "Phone import";
}


function setStatus(elements, message, tone = "neutral") {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function renderDetails(elements, details) {
  elements.detailsOutput.textContent = JSON.stringify(details || {}, null, 2);
}

function setBusy(elements, busy, state) {
  elements.scan.disabled = busy;
  elements.backupPath.disabled = busy;
  elements.cancel.disabled = !busy;
  elements.importButton.disabled = busy || !state.scanResult || !state.selected.size || !elements.acknowledge.checked;
}

function sortConversations(conversations, mode) {
  const copy = [...conversations];
  if (mode === "messages") return copy.sort((a, b) => Number(b.messageCount || 0) - Number(a.messageCount || 0));
  if (mode === "title") return copy.sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));
  return copy.sort((a, b) => Date.parse(b.lastMessageDate || 0) - Date.parse(a.lastMessageDate || 0));
}

function filteredConversations(state) {
  const filter = String(state.filter || "").trim().toLowerCase();
  const rows = filter
    ? state.conversations.filter((conversation) => [conversation.displayName, ...(conversation.participants || [])].join(" ").toLowerCase().includes(filter))
    : state.conversations;
  return sortConversations(rows, state.sortMode);
}

function renderSummary(elements, result) {
  const backup = result?.backup || {};
  const messages = result?.messages || {};
  const stats = [
    ["Device", backup.deviceName || "iPhone Backup"],
    ["iOS", backup.productVersion || "Unknown"],
    ["Conversations", messages.conversationCount || 0],
    ["Messages", messages.messageCount || 0],
    ["Attachments", messages.attachmentCount || 0],
    ["Last message", formatDate(messages.dateRange?.last)],
  ];
  elements.summary.innerHTML = stats.map(([label, value]) => '<div class="nv-phone-import-stat"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(String(value)) + '</strong></div>').join("");
}

function renderConversationTable(elements, state) {
  const rows = filteredConversations(state);
  if (!rows.length) {
    elements.conversationList.innerHTML = '<tr><td colspan="7">No conversations match the current filter.</td></tr>';
    return;
  }
  elements.conversationList.innerHTML = rows.map((conversation) => {
    const checked = state.selected.has(conversation.id) ? " checked" : "";
    return '<tr>' +
      '<td><input type="checkbox" data-conversation-id="' + escapeHtml(conversation.id) + '"' + checked + '></td>' +
      '<td>' + escapeHtml(conversation.displayName || "Conversation") + '</td>' +
      '<td>' + escapeHtml((conversation.participants || []).join(", ") || "Unknown participant") + '</td>' +
      '<td>' + escapeHtml(String(conversation.messageCount || 0)) + '</td>' +
      '<td>' + escapeHtml(String(conversation.attachmentCount || 0)) + '</td>' +
      '<td>' + escapeHtml(formatDate(conversation.firstMessageDate)) + '</td>' +
      '<td>' + escapeHtml(formatDate(conversation.lastMessageDate)) + '</td>' +
      '</tr>';
  }).join("");
}

function renderPreview(elements, state, result) {
  state.scanResult = result;
  state.conversations = Array.isArray(result?.conversations) ? result.conversations : [];
  state.selected = new Set(state.conversations.map((conversation) => conversation.id));
  elements.preview.dataset.visible = result?.messages?.databaseFound ? "true" : "false";
  renderSummary(elements, result);
  renderConversationTable(elements, state);
  const warningCount = Array.isArray(result?.warnings) ? result.warnings.length : 0;
  setStatus(elements, warningCount ? "Ready to import with " + warningCount + " warning(s)" : "Ready to import", warningCount ? "warning" : "success");
}

function renderImportResult(elements, result) {
  if (!result?.ok) {
    elements.resultLinks.innerHTML = "";
    return;
  }
  elements.resultLinks.innerHTML = '<div class="nv-phone-import-status" data-tone="success">' +
    '<div><strong>Import completed</strong></div>' +
    '<div><a href="' + escapeHtml(notebookUrl(result.indexPath)) + '" target="_blank" rel="noopener">Conversations index</a></div>' +
    '<div><a href="' + escapeHtml(notebookUrl(result.reportPath)) + '" target="_blank" rel="noopener">Import report</a></div>' +
    '</div>';
}

async function pollJob(jobId, elements, state, onComplete) {
  clearTimeout(state.pollTimer);
  const tick = async () => {
    if (state.disposed) return;
    try {
      const payload = await getJson("/api/phone-import/status/" + encodeURIComponent(jobId));
      const job = payload.job || {};
      const tone = job.status === "failed" ? "error" : (job.status === "completed" ? "success" : "neutral");
      setStatus(elements, job.message || stateMessage(job.state), tone);
      renderDetails(elements, { state: job.state, status: job.status, progress: job.progress, warnings: job.warnings, error: job.error, technicalDetails: job.technicalDetails, result: job.result });
      if (job.status === "completed") {
        await onComplete(job.result, job);
        setBusy(elements, false, state);
        return;
      }
      if (job.status === "failed" || job.status === "cancelled") {
        setStatus(elements, job.message || stateMessage(job.state), job.status === "failed" ? "error" : "warning");
        setBusy(elements, false, state);
        return;
      }
      state.pollTimer = setTimeout(tick, POLL_MS);
    } catch (err) {
      setStatus(elements, err.message || "Phone import status failed", "error");
      renderDetails(elements, err.payload || { message: err.message });
      setBusy(elements, false, state);
    }
  };
  await tick();
}

export async function setupPanel(panelElem, panelVars = {}) {
  if (!panelElem) return;
  ensureStylesheet();
  updateToolbarState({ activePanelType: "PhoneImportPanel" });
  navigationState.setLastInfoPanelType("PhoneImportPanel");

  panelElem.innerHTML = TEMPLATE;
  const titleEl = panelElem.querySelector(".panel-title");
  if (titleEl) titleEl.textContent = "Phone Import";

  const elements = {
    root: panelElem.querySelector("[data-phone-import-root]"),
    refresh: panelElem.querySelector("[data-refresh-status]"),
    backupPath: panelElem.querySelector("[data-backup-path]"),
    scan: panelElem.querySelector("[data-scan]"),
    cancel: panelElem.querySelector("[data-cancel]"),
    status: panelElem.querySelector("[data-status]"),
    preview: panelElem.querySelector("[data-preview]"),
    summary: panelElem.querySelector("[data-summary]"),
    filter: panelElem.querySelector("[data-filter]"),
    sort: panelElem.querySelector("[data-sort]"),
    selectAll: panelElem.querySelector("[data-select-all]"),
    selectNone: panelElem.querySelector("[data-select-none]"),
    conversationList: panelElem.querySelector("[data-conversation-list]"),
    destination: panelElem.querySelector("[data-destination]"),
    copyAttachments: panelElem.querySelector("[data-copy-attachments]"),
    acknowledge: panelElem.querySelector("[data-acknowledge]"),
    importButton: panelElem.querySelector("[data-import]"),
    resultLinks: panelElem.querySelector("[data-result-links]"),
    detailsOutput: panelElem.querySelector("[data-details-output]"),
  };

  const state = {
    disposed: false,
    pollTimer: null,
    activeJobId: null,
    scanJobId: null,
    scanResult: null,
    conversations: [],
    selected: new Set(),
    filter: "",
    sortMode: "recent",
  };

  elements.backupPath.value = panelVars.backupPath || "";
  elements.acknowledge.checked = localStorage.getItem(ACK_KEY) === "true";

  const refreshImportButton = () => setBusy(elements, Boolean(state.activeJobId), state);

  elements.scan.addEventListener("click", async () => {
    const backupPath = elements.backupPath.value.trim();
    if (!backupPath) {
      setStatus(elements, stateMessage("no_backup_selected"), "warning");
      return;
    }
    state.scanResult = null;
    state.conversations = [];
    state.selected.clear();
    elements.preview.dataset.visible = "false";
    elements.resultLinks.innerHTML = "";
    setBusy(elements, true, state);
    setStatus(elements, stateMessage("scanning_backup"));
    try {
      const payload = await postJson("/api/phone-import/scan", { backupPath });
      state.activeJobId = payload.jobId;
      state.scanJobId = payload.jobId;
      await pollJob(payload.jobId, elements, state, async (result) => {
        state.activeJobId = null;
        if (result?.messages?.databaseFound) renderPreview(elements, state, result);
        else {
          elements.preview.dataset.visible = "false";
          setStatus(elements, stateMessage("messages_database_not_found"), "warning");
        }
      });
    } catch (err) {
      state.activeJobId = null;
      setStatus(elements, err.message || "Scan failed", "error");
      renderDetails(elements, err.payload || { message: err.message });
      setBusy(elements, false, state);
    }
  });

  elements.importButton.addEventListener("click", async () => {
    if (!state.scanResult?.scanId) return;
    if (!state.selected.size) {
      setStatus(elements, "Select at least one conversation to import.", "warning");
      return;
    }
    if (!elements.acknowledge.checked) {
      setStatus(elements, "Acknowledge the phone backup privacy warning before importing.", "warning");
      return;
    }
    localStorage.setItem(ACK_KEY, "true");
    setBusy(elements, true, state);
    setStatus(elements, stateMessage("importing"));
    elements.resultLinks.innerHTML = "";
    try {
      const payload = await postJson("/api/phone-import/import", {
        scanId: state.scanResult.scanId,
        conversationIds: [...state.selected],
        destination: elements.destination.value,
        copyAttachments: elements.copyAttachments.checked,
        includeSourceMetadata: true,
        privacyAcknowledged: true,
      });
      state.activeJobId = payload.jobId;
      await pollJob(payload.jobId, elements, state, async (result) => {
        state.activeJobId = null;
        renderImportResult(elements, result);
        const tone = result?.status === "completed_with_warnings" ? "warning" : "success";
        setStatus(elements, stateMessage(result?.state || "import_completed"), tone);
      });
    } catch (err) {
      state.activeJobId = null;
      setStatus(elements, err.message || "Import failed", "error");
      renderDetails(elements, err.payload || { message: err.message });
      setBusy(elements, false, state);
    }
  });


  elements.cancel.addEventListener("click", async () => {
    if (!state.activeJobId) return;
    const jobId = state.activeJobId;
    state.activeJobId = null;
    clearTimeout(state.pollTimer);
    try {
      const payload = await postJson("/api/phone-import/cancel/" + encodeURIComponent(jobId), {});
      setStatus(elements, payload.job?.message || "Cancelled", "warning");
      renderDetails(elements, { cancelledJob: payload.job });
    } catch (err) {
      setStatus(elements, err.message || "Cancel failed", "error");
    } finally {
      setBusy(elements, false, state);
    }
  });

  elements.refresh.addEventListener("click", async () => {
    const jobId = state.activeJobId || state.scanJobId;
    if (!jobId) {
      setStatus(elements, state.scanResult ? "Ready to import" : stateMessage("no_backup_selected"), state.scanResult ? "success" : "neutral");
      return;
    }
    try {
      const payload = await getJson("/api/phone-import/status/" + encodeURIComponent(jobId));
      renderDetails(elements, payload.job || {});
      setStatus(elements, payload.job?.message || stateMessage(payload.job?.state), payload.job?.status === "failed" ? "error" : "neutral");
    } catch (err) {
      setStatus(elements, err.message || "Refresh failed", "error");
    }
  });

  elements.filter.addEventListener("input", () => {
    state.filter = elements.filter.value;
    renderConversationTable(elements, state);
  });

  elements.sort.addEventListener("change", () => {
    state.sortMode = elements.sort.value;
    renderConversationTable(elements, state);
  });

  elements.selectAll.addEventListener("click", () => {
    for (const conversation of filteredConversations(state)) state.selected.add(conversation.id);
    renderConversationTable(elements, state);
    refreshImportButton();
  });

  elements.selectNone.addEventListener("click", () => {
    state.selected.clear();
    renderConversationTable(elements, state);
    refreshImportButton();
  });

  elements.conversationList.addEventListener("change", (evt) => {
    const checkbox = evt.target?.closest?.("input[data-conversation-id]");
    if (!checkbox) return;
    const id = checkbox.dataset.conversationId;
    if (checkbox.checked) state.selected.add(id);
    else state.selected.delete(id);
    refreshImportButton();
  });

  elements.acknowledge.addEventListener("change", () => {
    if (elements.acknowledge.checked) localStorage.setItem(ACK_KEY, "true");
    refreshImportButton();
  });

  setBusy(elements, false, state);

  return () => {
    state.disposed = true;
    clearTimeout(state.pollTimer);
  };
}

export default setupPanel;

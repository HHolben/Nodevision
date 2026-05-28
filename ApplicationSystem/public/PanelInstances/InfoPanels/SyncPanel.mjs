// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SyncPanel.mjs
// This file renders a security-first Sync Info Panel that controls LAN scanning/discoverability, shows trusted and untrusted discovered peers, allows explicit peer selection, manages shared sync scopes, and runs explicit dry-run or apply sync actions without exposing private keys or server settings contents.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";

const navigationState = getNodevisionNavigationState();

const TEMPLATE = `
  <div style="display:flex;flex-direction:column;gap:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div>
        <h3 style="margin:0;font-size:1.1em;">Sync</h3>
        <p style="margin:4px 0 0;color:#666;font-size:0.9em;">Discover trusted peers and run explicit scope-limited sync actions.</p>
      </div>
      <button type="button" data-refresh style="border:1px solid #ccc;border-radius:6px;background:#fff;padding:6px 10px;font-size:0.85em;cursor:pointer;">Refresh</button>
    </div>
    <div data-error style="display:none;padding:8px 10px;border-radius:6px;background:#ffecec;color:#9d1e1e;font-size:0.9em;"></div>
    <div data-status style="min-height:20px;color:#444;font-size:0.9em;"></div>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fafafa;">
      <div style="font-weight:600;margin-bottom:6px;">Local Device</div>
      <div data-local-device style="font-size:0.9em;color:#333;">Loading...</div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">
        <div>
          <div style="font-weight:600;">Installation Protection</div>
          <div data-protect-writes-detail style="color:#666;font-size:0.84em;margin-top:3px;">Incoming peer writes and local apply sync are blocked while protection is on. Dry runs still work.</div>
        </div>
        <span data-protect-writes-badge style="white-space:nowrap;border:1px solid #ccc;border-radius:999px;padding:3px 8px;font-size:0.76em;color:#555;background:#f7f7f7;">Loading</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <button type="button" data-protect-enable style="border:1px solid #b74d4d;border-radius:6px;background:#fff4f4;color:#8e2424;padding:7px 10px;cursor:pointer;font-size:0.88em;">Protect This Installation</button>
        <button type="button" data-protect-disable style="border:1px solid #5b9d6d;border-radius:6px;background:#f1fbf3;color:#236535;padding:7px 10px;cursor:pointer;font-size:0.88em;">Allow Changes Here</button>
        <label style="display:flex;gap:6px;align-items:center;font-size:0.82em;color:#555;">
          <input type="checkbox" data-protect-writes>
          <span>Protected</span>
        </label>
      </div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fafafa;">
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
        <button type="button" data-toggle-scanning style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:7px 10px;cursor:pointer;font-size:0.9em;">Scan for Devices</button>
        <button type="button" data-toggle-discoverable style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:7px 10px;cursor:pointer;font-size:0.9em;">Make This Device Discoverable</button>
      </div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-weight:600;">Discovered Devices</div>
        <span data-peer-count style="font-size:0.85em;color:#666;">0 peers</span>
      </div>
      <div data-peer-list style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow:auto;"></div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;">
        <div style="font-weight:600;">Shared Folders</div>
        <button type="button" data-folders-refresh style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:5px 9px;cursor:pointer;font-size:0.82em;">Refresh Folders</button>
      </div>
      <div data-shared-scopes style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;"></div>
      <div data-folder-list style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow:auto;"></div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">
        <label style="display:flex;flex-direction:column;font-size:0.9em;gap:4px;">Scope
          <select data-scope-select style="padding:7px;border:1px solid #bbb;border-radius:6px;min-width:150px;"></select>
        </label>
        <button type="button" data-sync-dry style="border:1px solid #777;border-radius:6px;background:#fff;padding:7px 10px;cursor:pointer;font-size:0.9em;">Dry Run Sync</button>
        <button type="button" data-sync-apply style="border:none;border-radius:6px;background:#0a84ff;color:#fff;padding:8px 12px;cursor:pointer;font-size:0.9em;">Apply Sync</button>
      </div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fdfdfd;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="font-weight:600;">Sync Job Progress</div>
        <button type="button" data-sync-cancel style="display:none;border:1px solid #c74747;border-radius:6px;background:#fff4f4;color:#902222;padding:6px 10px;cursor:pointer;font-size:0.82em;">Cancel Job</button>
      </div>
      <div data-job-status style="margin-top:6px;font-size:0.88em;color:#333;">No active sync job.</div>
      <div data-job-progress style="margin-top:4px;font-size:0.82em;color:#555;"></div>
      <div data-job-errors style="margin-top:6px;display:none;padding:6px 8px;border-radius:6px;background:#ffecec;color:#8b1c1c;font-size:0.82em;"></div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
        <div>
          <div style="font-weight:600;">Live Sync Events</div>
          <div data-sync-events-warning style="display:none;margin-top:3px;color:#8f4f00;font-size:0.78em;"></div>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" data-sync-events-refresh style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:5px 9px;cursor:pointer;font-size:0.82em;">Refresh Events</button>
          <button type="button" data-sync-events-clear style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:5px 9px;cursor:pointer;font-size:0.82em;">Clear View</button>
        </div>
      </div>
      <div data-sync-events-list style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto;font-size:0.82em;"></div>
    </section>

    <details data-sync-details style="border:1px solid #ddd;border-radius:8px;padding:8px;background:#fdfdfd;">
      <summary style="cursor:pointer;font-weight:600;">Latest Sync Result</summary>
      <pre data-sync-result style="margin-top:8px;max-height:260px;overflow:auto;white-space:pre-wrap;font-size:0.85em;color:#1f1f1f;"></pre>
    </details>
  </div>
`;

const escapeHtml = (v = "") => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const shortenDeviceId = (id = "") => (String(id).length <= 16 ? String(id) : `${String(id).slice(0, 8)}...${String(id).slice(-6)}`);
const shortenJobId = (id = "") => { const text = String(id); return text.length <= 14 ? text : text.slice(0, 8) + "..."; };
const setStatus = (el, msg = "") => { if (el) el.textContent = String(msg); };
function setError(el, msg = "") { if (!el) return; const t = String(msg || "").trim(); el.style.display = t ? "block" : "none"; el.textContent = t; }

export function formatSyncEventBytes(done, total) {
  const format = (value) => {
    const num = Number(value || 0);
    if (num < 1024) return num + " B";
    if (num < 1024 * 1024) return (num / 1024).toFixed(1) + " KB";
    return (num / (1024 * 1024)).toFixed(1) + " MB";
  };
  return format(done) + "/" + format(total);
}

export function getSyncEventType(topic = "") {
  return String(topic).replace(/^nodevision\/sync\/?/, "");
}

function isSafeRelativePath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("/") || /^[A-Za-z]:[\\/]/.test(text)) return "";
  if (text.split(/[\\/]+/).includes("ServerSettings")) return "";
  return text;
}


async function apiFetchJson(url, init = {}) {
  const response = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const baseError = String(payload?.error || `Request failed (${response.status})`).trim();
    const details = String(payload?.details || "").trim();
    throw new Error(details ? `${baseError}: ${details}` : baseError);
  }
  return payload;
}

export async function setupPanel(panelElem, panelVars = {}) {
  updateToolbarState({ activePanelType: "SyncPanel" });
  navigationState.setLastInfoPanelType("SyncPanel");
  if (typeof panelElem.cleanup === "function") { try { panelElem.cleanup(); } catch {} }
  panelElem.innerHTML = TEMPLATE;
  const titleEl = panelElem.querySelector(".panel-title"); if (titleEl) titleEl.textContent = panelVars.displayName || "Sync";

  const errorEl = panelElem.querySelector("[data-error]");
  const statusEl = panelElem.querySelector("[data-status]");
  const localDeviceEl = panelElem.querySelector("[data-local-device]");
  const protectWritesEl = panelElem.querySelector("[data-protect-writes]");
  const protectWritesDetailEl = panelElem.querySelector("[data-protect-writes-detail]");
  const protectWritesBadgeEl = panelElem.querySelector("[data-protect-writes-badge]");
  const protectEnableBtn = panelElem.querySelector("[data-protect-enable]");
  const protectDisableBtn = panelElem.querySelector("[data-protect-disable]");
  const scanningBtn = panelElem.querySelector("[data-toggle-scanning]");
  const discoverableBtn = panelElem.querySelector("[data-toggle-discoverable]");
  const refreshBtn = panelElem.querySelector("[data-refresh]");
  const peerCountEl = panelElem.querySelector("[data-peer-count]");
  const peerListEl = panelElem.querySelector("[data-peer-list]");
  const scopeSelect = panelElem.querySelector("[data-scope-select]");
  const syncDryBtn = panelElem.querySelector("[data-sync-dry]");
  const syncApplyBtn = panelElem.querySelector("[data-sync-apply]");
  const syncResultEl = panelElem.querySelector("[data-sync-result]");
  const syncDetailsEl = panelElem.querySelector("[data-sync-details]");
  const foldersRefreshBtn = panelElem.querySelector("[data-folders-refresh]");
  const sharedScopesEl = panelElem.querySelector("[data-shared-scopes]");
  const folderListEl = panelElem.querySelector("[data-folder-list]");
  const jobStatusEl = panelElem.querySelector("[data-job-status]");
  const jobProgressEl = panelElem.querySelector("[data-job-progress]");
  const jobErrorsEl = panelElem.querySelector("[data-job-errors]");
  const syncCancelBtn = panelElem.querySelector("[data-sync-cancel]");
  const syncEventsListEl = panelElem.querySelector("[data-sync-events-list]");
  const syncEventsWarningEl = panelElem.querySelector("[data-sync-events-warning]");
  const syncEventsRefreshBtn = panelElem.querySelector("[data-sync-events-refresh]");
  const syncEventsClearBtn = panelElem.querySelector("[data-sync-events-clear]");

  const state = {
    disposed: false,
    refreshTimer: null,
    busy: false,
    localDevice: null,
    protection: { protectedFromPeerWrites: false },
    status: { discovery: { scanning: false, discoverable: false }, discoveredPeers: [], selectedPeerDeviceId: null },
    scopes: ["SyncTest"],
    candidateFolders: [],
    activeJob: null,
    activeJobId: null,
    syncEvents: [],
    eventsClearedAt: 0,
    eventsPollTimer: null,
  };

  const renderLocalDevice = () => {
    if (!localDeviceEl) return;
    if (!state.localDevice) { localDeviceEl.textContent = "Unavailable"; return; }
    localDeviceEl.innerHTML = `<div><strong>${escapeHtml(state.localDevice.deviceName || "Unknown Device")}</strong></div><div style="font-size:0.85em;color:#666;">${escapeHtml(state.localDevice.deviceId || "")}</div>`;
  };

  const renderProtection = () => {
    const protectedOn = state.protection?.protectedFromPeerWrites === true;
    if (protectWritesEl) protectWritesEl.checked = protectedOn;
    if (protectWritesDetailEl) {
      protectWritesDetailEl.textContent = protectedOn
        ? "Protected: incoming peer writes and local apply sync are blocked. Dry runs still work."
        : "Incoming peer writes and local apply sync are allowed. Dry runs still work.";
    }
    if (protectWritesBadgeEl) {
      protectWritesBadgeEl.textContent = protectedOn ? "Protected" : "Writable";
      protectWritesBadgeEl.style.background = protectedOn ? "#fff4f4" : "#f1fbf3";
      protectWritesBadgeEl.style.borderColor = protectedOn ? "#e6a3a3" : "#b9dfc2";
      protectWritesBadgeEl.style.color = protectedOn ? "#8e2424" : "#236535";
    }
    if (protectEnableBtn) {
      protectEnableBtn.disabled = state.busy || protectedOn;
      protectEnableBtn.style.opacity = protectedOn ? "0.6" : "1";
      protectEnableBtn.style.cursor = state.busy || protectedOn ? "not-allowed" : "pointer";
    }
    if (protectDisableBtn) {
      protectDisableBtn.disabled = state.busy || !protectedOn;
      protectDisableBtn.style.opacity = protectedOn ? "1" : "0.6";
      protectDisableBtn.style.cursor = state.busy || !protectedOn ? "not-allowed" : "pointer";
    }
    if (syncApplyBtn) syncApplyBtn.disabled = state.busy || protectedOn;
  };

  const renderDiscoveryButtons = () => {
    if (!scanningBtn || !discoverableBtn) return;
    const scanning = state.status.discovery?.scanning === true;
    const discoverable = state.status.discovery?.discoverable === true;
    scanningBtn.textContent = scanning ? "Stop Scanning" : "Scan for Devices";
    discoverableBtn.textContent = discoverable ? "Stop Discoverability" : "Make This Device Discoverable";
  };

  const renderPeers = () => {
    const peers = Array.isArray(state.status.discoveredPeers) ? state.status.discoveredPeers : [];
    if (peerCountEl) peerCountEl.textContent = `${peers.length} peer${peers.length === 1 ? "" : "s"}`;
    if (!peerListEl) return;
    peerListEl.innerHTML = peers.length
      ? peers.map((peer) => {
        const trusted = peer?.trusted === true;
        const syncCapable = peer?.capabilities?.sync === true;
        const selected = trusted && syncCapable && state.status.selectedPeerDeviceId === peer.deviceId;
        const badgeStyle = trusted
          ? "background:#e8f7ec;color:#216b34;border:1px solid #b7e2c4;"
          : "background:#fff3e6;color:#8f4f00;border:1px solid #ffd8a8;";
        const fingerprint = peer?.publicKeyFingerprint
          ? `<div style="font-size:0.78em;color:#666;">Key: ${escapeHtml(String(peer.publicKeyFingerprint))}</div>`
          : "";
        const actionButton = trusted
          ? `<button type="button" data-select-peer="${escapeHtml(peer.deviceId)}" ${(state.busy || !syncCapable) ? "disabled" : ""} style="border:1px solid ${selected ? "#0a84ff" : "#bbb"};border-radius:6px;background:#fff;padding:5px 8px;font-size:0.82em;cursor:${(state.busy || !syncCapable) ? "not-allowed" : "pointer"};${syncCapable ? "" : "opacity:0.6;"}">${syncCapable ? (selected ? "Selected for Sync" : "Select for Sync") : "Sync Unsupported"}</button>`
          : `<button type="button" data-trust-peer="${escapeHtml(peer.deviceId)}" ${state.busy ? "disabled" : ""} style="border:1px solid #c97d00;border-radius:6px;background:#fff7eb;color:#8f4f00;padding:5px 8px;font-size:0.82em;cursor:${state.busy ? "not-allowed" : "pointer"};">Approve/Trust Device</button>`;
        return `<div style="text-align:left;border:1px solid ${selected ? "#0a84ff" : "#d7d7d7"};border-radius:8px;background:#fff;padding:8px;display:flex;flex-direction:column;gap:5px;"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;"><strong style="font-size:0.92em;">${escapeHtml(peer.deviceName || "Unknown Device")}</strong><span style="font-size:0.74em;border-radius:999px;padding:2px 7px;${badgeStyle}">${trusted ? "trusted" : "untrusted"}</span></div><div style="font-size:0.82em;color:#4a4a4a;">${escapeHtml(shortenDeviceId(peer.deviceId || ""))}</div><div style="font-size:0.82em;color:#333;">${escapeHtml(`${peer.address || "unknown"}:${peer.port || "?"}`)}</div>${fingerprint}<div>${actionButton}</div></div>`;
      }).join("")
      : `<div style="font-size:0.9em;color:#777;">No peers discovered yet.</div>`;
  };

  const renderScopes = () => {
    if (!scopeSelect) return;
    const current = scopeSelect.value || "SyncTest";
    scopeSelect.innerHTML = state.scopes.map((scope) => `<option value="${escapeHtml(scope)}">${escapeHtml(scope)}</option>`).join("");
    scopeSelect.value = state.scopes.includes(current) ? current : (state.scopes.includes("SyncTest") ? "SyncTest" : state.scopes[0]);
  };

  const renderSharedScopes = () => {
    if (!sharedScopesEl) return;
    sharedScopesEl.innerHTML = state.scopes.map((scope) => `<button type="button" data-remove-scope="${escapeHtml(scope)}" ${scope === "SyncTest" ? "disabled" : ""} style="border:1px solid #ccc;border-radius:999px;background:#fff;padding:4px 8px;font-size:0.8em;${scope === "SyncTest" ? "opacity:0.6;cursor:not-allowed;" : "cursor:pointer;"}">${escapeHtml(scope)}${scope === "SyncTest" ? " (default)" : " · Remove"}</button>`).join("");
  };

  const renderCandidateFolders = () => {
    if (!folderListEl) return;
    folderListEl.innerHTML = state.candidateFolders.length ? state.candidateFolders.map((folder) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;border:1px solid #e2e2e2;border-radius:6px;padding:6px;background:#fff;"><div><div style="font-size:0.9em;color:#222;">${escapeHtml(folder.name || folder.relativePath || "")}</div><div style="font-size:0.78em;color:#666;">${escapeHtml(folder.relativePath || "")}</div></div><button type="button" data-share-scope="${escapeHtml(folder.relativePath || "")}" ${folder.syncEnabled ? "disabled" : ""} style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:5px 8px;font-size:0.8em;${folder.syncEnabled ? "opacity:0.6;cursor:not-allowed;" : "cursor:pointer;"}">${folder.syncEnabled ? "Shared" : "Share"}</button></div>`).join("") : `<div style="font-size:0.88em;color:#777;">No eligible top-level Notebook folders found.</div>`;
  };

  const isFinalJobStatus = (status) => ["complete", "failed", "cancelled"].includes(String(status || ""));
  const renderJob = () => {
    const job = state.activeJob && typeof state.activeJob === "object" ? state.activeJob : null;
    if (!job) {
      if (jobStatusEl) jobStatusEl.textContent = "No active sync job.";
      if (jobProgressEl) jobProgressEl.textContent = "";
      if (jobErrorsEl) {
        jobErrorsEl.style.display = "none";
        jobErrorsEl.textContent = "";
      }
      if (syncCancelBtn) syncCancelBtn.style.display = "none";
      return;
    }
    const status = String(job.status || "unknown");
    const filesDone = Number(job.filesDone || 0);
    const filesTotal = Number(job.filesTotal || 0);
    const bytesDone = Number(job.bytesDone || 0);
    const bytesTotal = Number(job.bytesTotal || 0);
    const currentFile = String(job.currentFile || "").trim();
    if (jobStatusEl) {
      const base = `Job ${job.jobId || ""} is ${status}.`;
      jobStatusEl.textContent = currentFile ? `${base} Current file: ${currentFile}` : base;
    }
    if (jobProgressEl) {
      jobProgressEl.textContent = `Files ${filesDone}/${filesTotal} | Bytes ${bytesDone}/${bytesTotal}`;
    }
    const errors = Array.isArray(job.errors) ? job.errors.filter(Boolean) : [];
    if (jobErrorsEl) {
      jobErrorsEl.style.display = errors.length ? "block" : "none";
      jobErrorsEl.textContent = errors.length ? errors.join("\n") : "";
    }
    if (syncCancelBtn) {
      const cancellable = status === "queued" || status === "running";
      syncCancelBtn.style.display = cancellable ? "inline-block" : "none";
      syncCancelBtn.disabled = state.busy || !cancellable;
    }
  };

  const renderSyncEvents = () => {
    if (!syncEventsListEl) return;
    const events = Array.isArray(state.syncEvents) ? state.syncEvents : [];
    if (!events.length) {
      syncEventsListEl.innerHTML = `<div style="color:#777;">No sync broker events in this view.</div>`;
      return;
    }
    syncEventsListEl.innerHTML = events.map((event) => {
      const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
      const topic = String(event?.topic || "");
      const type = getSyncEventType(topic);
      const timestamp = event?.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "--:--:--";
      const jobId = shortenJobId(payload.jobId || "");
      const scope = isSafeRelativePath(payload.scope) || "";
      const files = Number(payload.filesDone || 0) + "/" + Number(payload.filesTotal || 0);
      const bytes = formatSyncEventBytes(payload.bytesDone || 0, payload.bytesTotal || 0);
      const currentFile = isSafeRelativePath(payload.currentFile);
      const fileLine = currentFile ? `<div style="color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(currentFile)}</div>` : "";
      return `<div style="border:1px solid #e2e2e2;border-radius:6px;padding:7px;background:#fbfbfb;display:grid;gap:3px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <strong style="color:#222;">${escapeHtml(type)}</strong>
          <span style="color:#666;font-size:0.86em;">${escapeHtml(timestamp)}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;color:#444;">
          <span>job ${escapeHtml(jobId || "?")}</span>
          <span>${escapeHtml(scope)}</span>
          <span>${escapeHtml(payload.status || "")}</span>
          <span>files ${escapeHtml(files)}</span>
          <span>bytes ${escapeHtml(bytes)}</span>
        </div>
        ${fileLine}
      </div>`;
    }).join("");
  };

  const setSyncEventsWarning = (message = "") => {
    if (!syncEventsWarningEl) return;
    const text = String(message || "").trim();
    syncEventsWarningEl.style.display = text ? "block" : "none";
    syncEventsWarningEl.textContent = text;
  };

  const loadSyncEvents = async () => {
    try {
      const payload = await apiFetchJson("/api/broker/events?topicPrefix=nodevision%2Fsync%2F&limit=50", { cache: "no-store" });
      const events = Array.isArray(payload.events) ? payload.events : [];
      state.syncEvents = events
        .filter((event) => String(event?.topic || "").startsWith("nodevision/sync/"))
        .filter((event) => {
          const ts = Date.parse(event?.timestamp || "");
          return !Number.isFinite(ts) || ts >= state.eventsClearedAt;
        })
        .slice()
        .reverse();
      setSyncEventsWarning("");
      renderSyncEvents();
    } catch (err) {
      setSyncEventsWarning(err?.message || "Live sync events are unavailable.");
      renderSyncEvents();
    }
  };

  const setBusy = (busy, statusMessage = "") => {
    state.busy = Boolean(busy);
    [refreshBtn, scanningBtn, discoverableBtn, scopeSelect, syncDryBtn, syncApplyBtn, foldersRefreshBtn, protectWritesEl, protectEnableBtn, protectDisableBtn].forEach((el) => { if (el) el.disabled = state.busy; });
    renderJob();
    renderProtection();
    if (statusMessage) setStatus(statusEl, statusMessage);
  };

  const loadLocalDevice = async () => { const p = await apiFetchJson("/api/sync/local-device", { cache: "no-store" }); state.localDevice = p.localDevice || null; renderLocalDevice(); };
  const loadProtection = async () => { const p = await apiFetchJson("/api/sync/protection", { cache: "no-store" }); state.protection = p.protection || { protectedFromPeerWrites: false }; renderProtection(); };
  const loadScopes = async () => { try { const p = await apiFetchJson("/api/sync/scopes", { cache: "no-store" }); state.scopes = Array.isArray(p.syncScopes) && p.syncScopes.length ? p.syncScopes : ["SyncTest"]; } catch { state.scopes = ["SyncTest"]; } renderScopes(); renderSharedScopes(); };
  const loadFolders = async () => { try { const p = await apiFetchJson("/api/sync/notebook-folders", { cache: "no-store" }); state.candidateFolders = Array.isArray(p.folders) ? p.folders : []; } catch { state.candidateFolders = []; } renderCandidateFolders(); };
  const refreshStatus = async () => { const p = await apiFetchJson("/api/sync/status", { cache: "no-store" }); state.status = { discovery: p.discovery || { scanning: false, discoverable: false }, discoveredPeers: Array.isArray(p.discoveredPeers) ? p.discoveredPeers : [], selectedPeerDeviceId: p.selectedPeerDeviceId || null }; state.protection = p.protection || state.protection; renderDiscoveryButtons(); renderPeers(); renderProtection(); };
  const refreshActiveJob = async () => {
    const jobId = String(state.activeJobId || "").trim();
    if (!jobId) return;
    const currentStatus = String(state.activeJob?.status || "");
    if (isFinalJobStatus(currentStatus)) return;
    const payload = await apiFetchJson(`/api/sync/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    state.activeJob = payload.job || null;
    renderJob();
    if (syncResultEl && state.activeJob && isFinalJobStatus(state.activeJob.status)) {
      syncResultEl.textContent = JSON.stringify({ ok: state.activeJob.status === "complete", job: state.activeJob }, null, 2);
      if (syncDetailsEl) syncDetailsEl.open = true;
      setStatus(statusEl, state.activeJob.status === "complete" ? "Sync job completed." : `Sync job ${state.activeJob.status}.`);
    }
  };

  const runToggle = async (url, enabled, label) => { setError(errorEl, ""); setBusy(true, `${label}...`); try { await apiFetchJson(url, { method: "POST", body: JSON.stringify({ enabled }) }); await refreshStatus(); setStatus(statusEl, `${label} complete.`); } catch (err) { setError(errorEl, err?.message || "Request failed"); } finally { setBusy(false); } };
  const shareScope = async (scope) => { setBusy(true, "Adding shared folder..."); try { await apiFetchJson("/api/sync/scopes", { method: "POST", body: JSON.stringify({ scope }) }); await Promise.all([loadScopes(), loadFolders()]); } catch (err) { setError(errorEl, err?.message || "Failed to add scope"); } finally { setBusy(false); } };
  const unshareScope = async (scope) => { setBusy(true, "Removing shared folder..."); try { await apiFetchJson("/api/sync/scopes", { method: "DELETE", body: JSON.stringify({ scope }) }); await Promise.all([loadScopes(), loadFolders()]); } catch (err) { setError(errorEl, err?.message || "Failed to remove scope"); } finally { setBusy(false); } };
  const toggleProtection = async (enabled) => { setBusy(true, "Updating sync protection..."); try { const p = await apiFetchJson("/api/sync/protection", { method: "POST", body: JSON.stringify({ protectedFromPeerWrites: Boolean(enabled) }) }); state.protection = p.protection || { protectedFromPeerWrites: Boolean(enabled) }; renderProtection(); setStatus(statusEl, state.protection.protectedFromPeerWrites ? "This installation is protected from sync writes." : "Sync write protection disabled."); } catch (err) { setError(errorEl, err?.message || "Failed to update sync protection"); renderProtection(); } finally { setBusy(false); } };

  const runSync = async (dryRun) => {
    const deviceId = state.status.selectedPeerDeviceId;
    if (!deviceId) return setError(errorEl, "Select a discovered peer before running sync.");
    const selectedPeer = (Array.isArray(state.status.discoveredPeers) ? state.status.discoveredPeers : []).find((peer) => peer?.deviceId === deviceId) || null;
    if (!selectedPeer || selectedPeer.trusted !== true || selectedPeer?.capabilities?.sync !== true) {
      return setError(errorEl, "Only trusted sync-capable peers can be selected for sync.");
    }
    const scope = scopeSelect?.value || "SyncTest";
    if (!dryRun && state.protection?.protectedFromPeerWrites === true) {
      return setError(errorEl, "This installation is protected from sync writes. Disable protection before applying sync here.");
    }
    setError(errorEl, "");
    try {
      if (!dryRun) {
        setBusy(true, "Running preflight checks...");
        const preflight = await apiFetchJson("/api/sync/preflight", { method: "POST", body: JSON.stringify({ deviceId, scope }) });
        if (syncResultEl) syncResultEl.textContent = JSON.stringify(preflight, null, 2);
        if (syncDetailsEl) syncDetailsEl.open = true;
        setBusy(true, "Starting sync job...");
        const started = await apiFetchJson("/api/sync/jobs/start", { method: "POST", body: JSON.stringify({ deviceId, scope, dryRun: false }) });
        state.activeJobId = started.jobId || null;
        state.activeJob = started.job || null;
        renderJob();
        await refreshActiveJob().catch(() => {});
        setStatus(statusEl, "Sync job started.");
        return;
      }
      setBusy(true, dryRun ? "Running dry-run sync..." : "Running sync...");
      const payload = await apiFetchJson("/api/sync/run", { method: "POST", body: JSON.stringify({ deviceId, scope, dryRun: Boolean(dryRun) }) });
      if (syncResultEl) syncResultEl.textContent = JSON.stringify(payload, null, 2);
      if (syncDetailsEl) syncDetailsEl.open = true;
      await refreshStatus();
      setStatus(statusEl, dryRun ? "Dry-run sync completed." : "Sync completed.");
    } catch (err) {
      const msg = String(err?.message || "Sync failed");
      if (msg.includes("Scope is not enabled:")) {
        setError(errorEl, `${msg}. Scope "${scope}" must be shared on both devices before sync can run.`);
      } else if (msg.includes("Scope not yet supported")) {
        setError(errorEl, "This scope is configured, but generalized sync execution is not enabled yet.");
      } else {
        setError(errorEl, msg);
      }
    } finally { setBusy(false); }
  };

  peerListEl?.addEventListener("click", async (e) => {
    const trustButton = e.target?.closest?.("[data-trust-peer]");
    if (trustButton) {
      const deviceId = String(trustButton.getAttribute("data-trust-peer") || "");
      const peer = (Array.isArray(state.status.discoveredPeers) ? state.status.discoveredPeers : []).find((item) => String(item?.deviceId || "") === deviceId) || null;
      if (!peer) {
        setError(errorEl, "Discovered peer no longer available.");
        return;
      }
      const confirmed = window.confirm(
        `Trust this discovered device?\n\nDevice: ${String(peer.deviceName || "Unknown Device")}\nID: ${shortenDeviceId(peer.deviceId || "")}\nAddress: ${String(peer.address || "unknown")}:${String(peer.port || "?")}`,
      );
      if (!confirmed) return;

      setError(errorEl, "");
      setBusy(true, "Trusting device...");
      try {
        await apiFetchJson("/api/sync/trust-peer", {
          method: "POST",
          body: JSON.stringify({ deviceId }),
        });
        await refreshStatus();
        setStatus(statusEl, "Device trusted. You can now select it for sync.");
      } catch (err) {
        setError(errorEl, err?.message || "Unable to trust peer");
      } finally {
        setBusy(false);
      }
      return;
    }

    const selectButton = e.target?.closest?.("[data-select-peer]");
    if (!selectButton) return;
    const deviceId = String(selectButton.getAttribute("data-select-peer") || "");
    const selectedPeer = (Array.isArray(state.status.discoveredPeers) ? state.status.discoveredPeers : []).find((peer) => peer?.deviceId === deviceId) || null;
    if (!selectedPeer || selectedPeer.trusted !== true || selectedPeer?.capabilities?.sync !== true) {
      setError(errorEl, "Only trusted sync-capable peers can be selected.");
      return;
    }
    setError(errorEl, "");
    try {
      await apiFetchJson("/api/sync/select-peer", { method: "POST", body: JSON.stringify({ deviceId }) });
      await refreshStatus();
    } catch (err) {
      setError(errorEl, err?.message || "Unable to select peer");
    }
  });
  refreshBtn?.addEventListener("click", () => Promise.all([loadProtection(), loadScopes(), loadFolders(), refreshStatus()]).catch((err) => setError(errorEl, err?.message || "Refresh failed")));
  scanningBtn?.addEventListener("click", () => runToggle("/api/sync/discovery/scanning", !(state.status.discovery?.scanning === true), state.status.discovery?.scanning ? "Stopping scan" : "Starting scan"));
  discoverableBtn?.addEventListener("click", () => runToggle("/api/sync/discovery/discoverable", !(state.status.discovery?.discoverable === true), state.status.discovery?.discoverable ? "Disabling discoverability" : "Enabling discoverability"));
  protectWritesEl?.addEventListener("change", () => toggleProtection(protectWritesEl.checked));
  protectEnableBtn?.addEventListener("click", () => toggleProtection(true));
  protectDisableBtn?.addEventListener("click", () => toggleProtection(false));
  syncDryBtn?.addEventListener("click", () => runSync(true));
  syncApplyBtn?.addEventListener("click", () => runSync(false));
  syncEventsRefreshBtn?.addEventListener("click", () => loadSyncEvents());
  syncEventsClearBtn?.addEventListener("click", () => { state.eventsClearedAt = Date.now(); state.syncEvents = []; renderSyncEvents(); setSyncEventsWarning(""); });
  syncCancelBtn?.addEventListener("click", async () => {
    const jobId = String(state.activeJobId || "").trim();
    if (!jobId) return;
    setBusy(true, "Cancelling sync job...");
    try {
      const payload = await apiFetchJson(`/api/sync/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST", body: JSON.stringify({}) });
      state.activeJob = payload.job || state.activeJob;
      renderJob();
      setStatus(statusEl, "Sync job cancellation requested.");
    } catch (err) {
      setError(errorEl, err?.message || "Failed to cancel sync job");
    } finally {
      setBusy(false);
    }
  });
  foldersRefreshBtn?.addEventListener("click", () => Promise.all([loadScopes(), loadFolders()]).catch((err) => setError(errorEl, err?.message || "Folder refresh failed")));
  sharedScopesEl?.addEventListener("click", (e) => { const b = e.target?.closest?.("[data-remove-scope]"); if (!b) return; const scope = b.getAttribute("data-remove-scope"); if (scope && scope !== "SyncTest") unshareScope(scope); });
  folderListEl?.addEventListener("click", (e) => { const b = e.target?.closest?.("[data-share-scope]"); if (!b) return; const scope = b.getAttribute("data-share-scope"); if (scope) shareScope(scope); });

  panelElem.cleanup = () => { state.disposed = true; if (state.refreshTimer) clearInterval(state.refreshTimer); if (state.eventsPollTimer) clearInterval(state.eventsPollTimer); state.refreshTimer = null; state.eventsPollTimer = null; };
  try {
    setStatus(statusEl, "Loading sync panel...");
    await Promise.all([loadLocalDevice(), loadProtection(), loadScopes(), loadFolders(), refreshStatus()]);
    await loadSyncEvents();
    renderJob();
    setStatus(statusEl, "Sync panel ready.");
  } catch (err) {
    setError(errorEl, err?.message || "Failed to initialize sync panel");
  }
  state.refreshTimer = setInterval(() => {
    if (!state.disposed) {
      refreshStatus().catch(() => {});
      refreshActiveJob().catch(() => {});
    }
  }, 1000);
  state.eventsPollTimer = setInterval(() => {
    if (!state.disposed) loadSyncEvents().catch(() => {});
  }, 3000);
}

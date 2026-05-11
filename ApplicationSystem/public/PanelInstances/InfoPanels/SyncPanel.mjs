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

    <details data-sync-details style="border:1px solid #ddd;border-radius:8px;padding:8px;background:#fdfdfd;">
      <summary style="cursor:pointer;font-weight:600;">Latest Sync Result</summary>
      <pre data-sync-result style="margin-top:8px;max-height:260px;overflow:auto;white-space:pre-wrap;font-size:0.85em;color:#1f1f1f;"></pre>
    </details>
  </div>
`;

const escapeHtml = (v = "") => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const shortenDeviceId = (id = "") => (String(id).length <= 16 ? String(id) : `${String(id).slice(0, 8)}...${String(id).slice(-6)}`);
const setStatus = (el, msg = "") => { if (el) el.textContent = String(msg); };
function setError(el, msg = "") { if (!el) return; const t = String(msg || "").trim(); el.style.display = t ? "block" : "none"; el.textContent = t; }

async function apiFetchJson(url, init = {}) {
  const response = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
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

  const state = { disposed: false, refreshTimer: null, busy: false, localDevice: null, status: { discovery: { scanning: false, discoverable: false }, discoveredPeers: [], selectedPeerDeviceId: null }, scopes: ["SyncTest"], candidateFolders: [] };

  const renderLocalDevice = () => {
    if (!localDeviceEl) return;
    if (!state.localDevice) { localDeviceEl.textContent = "Unavailable"; return; }
    localDeviceEl.innerHTML = `<div><strong>${escapeHtml(state.localDevice.deviceName || "Unknown Device")}</strong></div><div style="font-size:0.85em;color:#666;">${escapeHtml(state.localDevice.deviceId || "")}</div>`;
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

  const setBusy = (busy, statusMessage = "") => {
    state.busy = Boolean(busy);
    [refreshBtn, scanningBtn, discoverableBtn, scopeSelect, syncDryBtn, syncApplyBtn, foldersRefreshBtn].forEach((el) => { if (el) el.disabled = state.busy; });
    if (statusMessage) setStatus(statusEl, statusMessage);
  };

  const loadLocalDevice = async () => { const p = await apiFetchJson("/api/sync/local-device", { cache: "no-store" }); state.localDevice = p.localDevice || null; renderLocalDevice(); };
  const loadScopes = async () => { try { const p = await apiFetchJson("/api/sync/scopes", { cache: "no-store" }); state.scopes = Array.isArray(p.syncScopes) && p.syncScopes.length ? p.syncScopes : ["SyncTest"]; } catch { state.scopes = ["SyncTest"]; } renderScopes(); renderSharedScopes(); };
  const loadFolders = async () => { try { const p = await apiFetchJson("/api/sync/notebook-folders", { cache: "no-store" }); state.candidateFolders = Array.isArray(p.folders) ? p.folders : []; } catch { state.candidateFolders = []; } renderCandidateFolders(); };
  const refreshStatus = async () => { const p = await apiFetchJson("/api/sync/status", { cache: "no-store" }); state.status = { discovery: p.discovery || { scanning: false, discoverable: false }, discoveredPeers: Array.isArray(p.discoveredPeers) ? p.discoveredPeers : [], selectedPeerDeviceId: p.selectedPeerDeviceId || null }; renderDiscoveryButtons(); renderPeers(); };

  const runToggle = async (url, enabled, label) => { setError(errorEl, ""); setBusy(true, `${label}...`); try { await apiFetchJson(url, { method: "POST", body: JSON.stringify({ enabled }) }); await refreshStatus(); setStatus(statusEl, `${label} complete.`); } catch (err) { setError(errorEl, err?.message || "Request failed"); } finally { setBusy(false); } };
  const shareScope = async (scope) => { setBusy(true, "Adding shared folder..."); try { await apiFetchJson("/api/sync/scopes", { method: "POST", body: JSON.stringify({ scope }) }); await Promise.all([loadScopes(), loadFolders()]); } catch (err) { setError(errorEl, err?.message || "Failed to add scope"); } finally { setBusy(false); } };
  const unshareScope = async (scope) => { setBusy(true, "Removing shared folder..."); try { await apiFetchJson("/api/sync/scopes", { method: "DELETE", body: JSON.stringify({ scope }) }); await Promise.all([loadScopes(), loadFolders()]); } catch (err) { setError(errorEl, err?.message || "Failed to remove scope"); } finally { setBusy(false); } };

  const runSync = async (dryRun) => {
    const deviceId = state.status.selectedPeerDeviceId;
    if (!deviceId) return setError(errorEl, "Select a discovered peer before running sync.");
    const selectedPeer = (Array.isArray(state.status.discoveredPeers) ? state.status.discoveredPeers : []).find((peer) => peer?.deviceId === deviceId) || null;
    if (!selectedPeer || selectedPeer.trusted !== true || selectedPeer?.capabilities?.sync !== true) {
      return setError(errorEl, "Only trusted sync-capable peers can be selected for sync.");
    }
    setError(errorEl, ""); setBusy(true, dryRun ? "Running dry-run sync..." : "Running sync...");
    try {
      const payload = await apiFetchJson("/api/sync/run", { method: "POST", body: JSON.stringify({ deviceId, scope: scopeSelect?.value || "SyncTest", dryRun: Boolean(dryRun) }) });
      if (syncResultEl) syncResultEl.textContent = JSON.stringify(payload, null, 2);
      if (syncDetailsEl) syncDetailsEl.open = true;
      await refreshStatus();
      setStatus(statusEl, dryRun ? "Dry-run sync completed." : "Sync completed.");
    } catch (err) {
      const msg = String(err?.message || "Sync failed");
      setError(errorEl, msg.includes("Scope not yet supported") ? "This scope is configured, but generalized sync execution is not enabled yet." : msg);
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
  refreshBtn?.addEventListener("click", () => Promise.all([loadScopes(), loadFolders(), refreshStatus()]).catch((err) => setError(errorEl, err?.message || "Refresh failed")));
  scanningBtn?.addEventListener("click", () => runToggle("/api/sync/discovery/scanning", !(state.status.discovery?.scanning === true), state.status.discovery?.scanning ? "Stopping scan" : "Starting scan"));
  discoverableBtn?.addEventListener("click", () => runToggle("/api/sync/discovery/discoverable", !(state.status.discovery?.discoverable === true), state.status.discovery?.discoverable ? "Disabling discoverability" : "Enabling discoverability"));
  syncDryBtn?.addEventListener("click", () => runSync(true));
  syncApplyBtn?.addEventListener("click", () => runSync(false));
  foldersRefreshBtn?.addEventListener("click", () => Promise.all([loadScopes(), loadFolders()]).catch((err) => setError(errorEl, err?.message || "Folder refresh failed")));
  sharedScopesEl?.addEventListener("click", (e) => { const b = e.target?.closest?.("[data-remove-scope]"); if (!b) return; const scope = b.getAttribute("data-remove-scope"); if (scope && scope !== "SyncTest") unshareScope(scope); });
  folderListEl?.addEventListener("click", (e) => { const b = e.target?.closest?.("[data-share-scope]"); if (!b) return; const scope = b.getAttribute("data-share-scope"); if (scope) shareScope(scope); });

  panelElem.cleanup = () => { state.disposed = true; if (state.refreshTimer) clearInterval(state.refreshTimer); state.refreshTimer = null; };
  try { setStatus(statusEl, "Loading sync panel..."); await Promise.all([loadLocalDevice(), loadScopes(), loadFolders(), refreshStatus()]); setStatus(statusEl, "Sync panel ready."); } catch (err) { setError(errorEl, err?.message || "Failed to initialize sync panel"); }
  state.refreshTimer = setInterval(() => { if (!state.disposed) refreshStatus().catch(() => {}); }, 4000);
}

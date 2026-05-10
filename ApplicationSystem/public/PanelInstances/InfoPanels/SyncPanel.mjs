// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SyncPanel.mjs
// This file renders a security-first Sync Info Panel that controls LAN scanning/discoverability, shows trusted and untrusted discovered peers, allows explicit peer selection, and runs explicit dry-run or apply sync actions without exposing private keys or server settings contents.

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
      <button type="button" data-refresh
        style="border:1px solid #ccc;border-radius:6px;background:#fff;padding:6px 10px;font-size:0.85em;cursor:pointer;">
        Refresh
      </button>
    </div>

    <div data-error style="display:none;padding:8px 10px;border-radius:6px;background:#ffecec;color:#9d1e1e;font-size:0.9em;"></div>
    <div data-status style="min-height:20px;color:#444;font-size:0.9em;"></div>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fafafa;">
      <div style="font-weight:600;margin-bottom:6px;">Local Device</div>
      <div data-local-device style="font-size:0.9em;color:#333;">Loading...</div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fafafa;">
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
        <button type="button" data-toggle-scanning
          style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:7px 10px;cursor:pointer;font-size:0.9em;">
          Scan for Devices
        </button>
        <button type="button" data-toggle-discoverable
          style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:7px 10px;cursor:pointer;font-size:0.9em;">
          Make This Device Discoverable
        </button>
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
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">
        <label style="display:flex;flex-direction:column;font-size:0.9em;gap:4px;">
          Scope
          <select data-scope-select style="padding:7px;border:1px solid #bbb;border-radius:6px;min-width:150px;"></select>
        </label>
        <button type="button" data-sync-dry
          style="border:1px solid #777;border-radius:6px;background:#fff;padding:7px 10px;cursor:pointer;font-size:0.9em;">
          Dry Run Sync
        </button>
        <button type="button" data-sync-apply
          style="border:none;border-radius:6px;background:#0a84ff;color:#fff;padding:8px 12px;cursor:pointer;font-size:0.9em;">
          Apply Sync
        </button>
      </div>
    </section>

    <details data-sync-details style="border:1px solid #ddd;border-radius:8px;padding:8px;background:#fdfdfd;">
      <summary style="cursor:pointer;font-weight:600;">Latest Sync Result</summary>
      <pre data-sync-result style="margin-top:8px;max-height:260px;overflow:auto;white-space:pre-wrap;font-size:0.85em;color:#1f1f1f;"></pre>
    </details>
  </div>
`;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shortenDeviceId(deviceId = "") {
  const text = String(deviceId || "");
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

function formatLastSeen(isoText) {
  const text = String(isoText ?? "").trim();
  if (!text) return "unknown";
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return text;
  return new Date(ms).toLocaleString();
}

function setError(el, message = "") {
  if (!el) return;
  const text = String(message || "").trim();
  if (!text) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.textContent = text;
}

function setStatus(el, message = "") {
  if (!el) return;
  el.textContent = String(message || "");
}

async function apiFetchJson(url, init = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function buildPeerRow(peer, selectedDeviceId) {
  const trusted = peer?.trusted === true;
  const badgeBg = trusted ? "#dff7e5" : "#f7e4e4";
  const badgeColor = trusted ? "#1f6e3f" : "#8a2424";
  const selected = selectedDeviceId && selectedDeviceId === peer.deviceId;
  const borderColor = selected ? "#0a84ff" : "#d7d7d7";
  const syncCapable = peer?.capabilities?.sync === true;
  const syncText = syncCapable ? "sync" : "no-sync";

  return `
    <button type="button" data-select-peer="${escapeHtml(peer.deviceId)}"
      style="text-align:left;border:1px solid ${borderColor};border-radius:8px;background:#fff;padding:8px;cursor:pointer;display:flex;flex-direction:column;gap:5px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong style="font-size:0.92em;">${escapeHtml(peer.deviceName || "Unknown Device")}</strong>
        <span style="font-size:0.74em;padding:2px 6px;border-radius:999px;background:${badgeBg};color:${badgeColor};">${trusted ? "trusted" : "untrusted"}</span>
      </div>
      <div style="font-size:0.82em;color:#4a4a4a;">${escapeHtml(shortenDeviceId(peer.deviceId || ""))}</div>
      <div style="font-size:0.82em;color:#333;">${escapeHtml(`${peer.address || "unknown"}:${peer.port || "?"}`)}</div>
      <div style="font-size:0.78em;color:#666;">last seen: ${escapeHtml(formatLastSeen(peer.lastSeen))} · ${escapeHtml(syncText)}</div>
    </button>
  `;
}

export async function setupPanel(panelElem, panelVars = {}) {
  updateToolbarState({ activePanelType: "SyncPanel" });
  navigationState.setLastInfoPanelType("SyncPanel");

  if (typeof panelElem.cleanup === "function") {
    try {
      panelElem.cleanup();
    } catch {
      // no-op
    }
  }

  panelElem.innerHTML = TEMPLATE;
  const titleEl = panelElem.querySelector(".panel-title");
  if (titleEl) {
    titleEl.textContent = panelVars.displayName || "Sync";
  }

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

  const state = {
    disposed: false,
    refreshTimer: null,
    busy: false,
    localDevice: null,
    status: {
      discovery: { scanning: false, discoverable: false },
      discoveredPeers: [],
      selectedPeerDeviceId: null,
    },
    scopes: ["SyncTest"],
  };

  function renderLocalDevice() {
    if (!localDeviceEl) return;
    if (!state.localDevice) {
      localDeviceEl.textContent = "Unavailable";
      return;
    }
    localDeviceEl.innerHTML = `
      <div><strong>${escapeHtml(state.localDevice.deviceName || "Unknown Device")}</strong></div>
      <div style="font-size:0.85em;color:#666;">${escapeHtml(state.localDevice.deviceId || "")}</div>
    `;
  }

  function renderDiscoveryButtons() {
    if (!scanningBtn || !discoverableBtn) return;
    const scanning = state.status.discovery?.scanning === true;
    const discoverable = state.status.discovery?.discoverable === true;
    scanningBtn.textContent = scanning ? "Stop Scanning" : "Scan for Devices";
    discoverableBtn.textContent = discoverable ? "Stop Discoverability" : "Make This Device Discoverable";
    scanningBtn.style.background = scanning ? "#e9f8ed" : "#fff";
    discoverableBtn.style.background = discoverable ? "#e9f2ff" : "#fff";
  }

  function renderPeerList() {
    const peers = Array.isArray(state.status.discoveredPeers) ? state.status.discoveredPeers : [];
    if (peerCountEl) {
      peerCountEl.textContent = `${peers.length} peer${peers.length === 1 ? "" : "s"}`;
    }
    if (!peerListEl) return;
    if (peers.length === 0) {
      peerListEl.innerHTML = `<div style="font-size:0.9em;color:#777;">No peers discovered yet.</div>`;
      return;
    }
    peerListEl.innerHTML = peers
      .map((peer) => buildPeerRow(peer, state.status.selectedPeerDeviceId))
      .join("");
  }

  function renderScopes() {
    if (!scopeSelect) return;
    const current = scopeSelect.value || "SyncTest";
    scopeSelect.innerHTML = state.scopes
      .map((scope) => `<option value="${escapeHtml(scope)}">${escapeHtml(scope)}</option>`)
      .join("");
    if (state.scopes.includes(current)) {
      scopeSelect.value = current;
    } else if (state.scopes.includes("SyncTest")) {
      scopeSelect.value = "SyncTest";
    } else if (state.scopes.length > 0) {
      scopeSelect.value = state.scopes[0];
    }
  }

  function setBusy(busy, statusMessage = "") {
    state.busy = Boolean(busy);
    const disabled = state.busy;
    if (refreshBtn) refreshBtn.disabled = disabled;
    if (scanningBtn) scanningBtn.disabled = disabled;
    if (discoverableBtn) discoverableBtn.disabled = disabled;
    if (syncDryBtn) syncDryBtn.disabled = disabled;
    if (syncApplyBtn) syncApplyBtn.disabled = disabled;
    if (scopeSelect) scopeSelect.disabled = disabled;
    if (statusMessage) setStatus(statusEl, statusMessage);
  }

  async function loadLocalDevice() {
    const payload = await apiFetchJson("/api/sync/local-device", { cache: "no-store" });
    state.localDevice = payload.localDevice || null;
    renderLocalDevice();
  }

  async function loadScopes() {
    try {
      const payload = await apiFetchJson("/api/sync/scopes", { cache: "no-store" });
      const scopes = Array.isArray(payload.syncScopes) ? payload.syncScopes : [];
      state.scopes = scopes.length > 0 ? scopes : ["SyncTest"];
    } catch {
      state.scopes = ["SyncTest"];
    }
    renderScopes();
  }

  async function refreshStatus({ silent = false } = {}) {
    if (state.disposed) return;
    if (!silent) setStatus(statusEl, "Refreshing sync status...");
    const payload = await apiFetchJson("/api/sync/status", { cache: "no-store" });
    state.status = {
      discovery: payload.discovery || { scanning: false, discoverable: false },
      discoveredPeers: Array.isArray(payload.discoveredPeers) ? payload.discoveredPeers : [],
      selectedPeerDeviceId: payload.selectedPeerDeviceId || null,
    };
    renderDiscoveryButtons();
    renderPeerList();
    if (!silent) {
      const scanning = state.status.discovery.scanning ? "on" : "off";
      const discoverable = state.status.discovery.discoverable ? "on" : "off";
      setStatus(statusEl, `Scanning: ${scanning} · Discoverable: ${discoverable}`);
    }
  }

  async function postToggle(url, enabled, label) {
    setError(errorEl, "");
    setBusy(true, `${label}...`);
    try {
      const payload = await apiFetchJson(url, {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
      state.status = {
        discovery: payload.discovery || { scanning: false, discoverable: false },
        discoveredPeers: Array.isArray(payload.discoveredPeers) ? payload.discoveredPeers : [],
        selectedPeerDeviceId: payload.selectedPeerDeviceId || null,
      };
      renderDiscoveryButtons();
      renderPeerList();
      setStatus(statusEl, `${label} complete.`);
    } catch (err) {
      setError(errorEl, err?.message || "Request failed");
      setStatus(statusEl, `${label} failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function selectPeer(deviceId) {
    setError(errorEl, "");
    setBusy(true, "Selecting peer...");
    try {
      const payload = await apiFetchJson("/api/sync/select-peer", {
        method: "POST",
        body: JSON.stringify({ deviceId }),
      });
      state.status = {
        discovery: payload.discovery || { scanning: false, discoverable: false },
        discoveredPeers: Array.isArray(payload.discoveredPeers) ? payload.discoveredPeers : [],
        selectedPeerDeviceId: payload.selectedPeerDeviceId || null,
      };
      renderPeerList();
      renderDiscoveryButtons();
      setStatus(statusEl, "Peer selected.");
    } catch (err) {
      setError(errorEl, err?.message || "Unable to select peer");
      setStatus(statusEl, "Peer selection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runSync(dryRun) {
    const deviceId = state.status.selectedPeerDeviceId;
    if (!deviceId) {
      setError(errorEl, "Select a discovered peer before running sync.");
      return;
    }
    setError(errorEl, "");
    setBusy(true, dryRun ? "Running dry-run sync..." : "Running sync...");

    try {
      const payload = await apiFetchJson("/api/sync/run", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          scope: scopeSelect?.value || "SyncTest",
          dryRun: Boolean(dryRun),
        }),
      });

      if (syncResultEl) {
        syncResultEl.textContent = JSON.stringify(payload, null, 2);
      }
      if (syncDetailsEl) {
        syncDetailsEl.open = true;
      }
      setStatus(statusEl, dryRun ? "Dry-run sync completed." : "Sync completed.");
      await refreshStatus({ silent: true });
    } catch (err) {
      setError(errorEl, err?.message || "Sync failed");
      setStatus(statusEl, "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  peerListEl?.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-select-peer]");
    if (!button) return;
    const deviceId = button.getAttribute("data-select-peer");
    if (!deviceId) return;
    selectPeer(deviceId);
  });

  refreshBtn?.addEventListener("click", async () => {
    setError(errorEl, "");
    try {
      await refreshStatus();
    } catch (err) {
      setError(errorEl, err?.message || "Failed to refresh sync status");
      setStatus(statusEl, "Refresh failed.");
    }
  });

  scanningBtn?.addEventListener("click", () => {
    const enabled = !(state.status.discovery?.scanning === true);
    postToggle("/api/sync/discovery/scanning", enabled, enabled ? "Starting scan" : "Stopping scan");
  });

  discoverableBtn?.addEventListener("click", () => {
    const enabled = !(state.status.discovery?.discoverable === true);
    postToggle("/api/sync/discovery/discoverable", enabled, enabled ? "Enabling discoverability" : "Disabling discoverability");
  });

  syncDryBtn?.addEventListener("click", () => runSync(true));
  syncApplyBtn?.addEventListener("click", () => runSync(false));

  panelElem.cleanup = () => {
    state.disposed = true;
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
      state.refreshTimer = null;
    }
  };

  try {
    setStatus(statusEl, "Loading sync panel...");
    await Promise.all([loadLocalDevice(), loadScopes(), refreshStatus()]);
    setStatus(statusEl, "Sync panel ready.");
  } catch (err) {
    setError(errorEl, err?.message || "Failed to initialize sync panel");
    setStatus(statusEl, "Initialization failed.");
  }

  state.refreshTimer = setInterval(() => {
    refreshStatus({ silent: true }).catch((err) => {
      if (!state.disposed) {
        setError(errorEl, err?.message || "Failed to refresh sync status");
      }
    });
  }, 4000);
}

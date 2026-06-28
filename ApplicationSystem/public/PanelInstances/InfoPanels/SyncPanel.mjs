// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SyncPanel.mjs
// This file renders a security-first Sync Info Panel that controls LAN scanning/discoverability, shows trusted and untrusted discovered peers, allows explicit peer selection, manages shared sync scopes, and runs explicit dry-run or apply sync actions without exposing private keys or server settings contents.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";
import { getActivePeerUrl, normalizeSyncTransport, withActivePeerUrlFromDiscoveredPeer } from "/SyncTransportSettings.mjs";

const navigationState = getNodevisionNavigationState();

const TEMPLATE = `
  <div data-sync-panel-root style="display:flex;flex-direction:column;gap:10px;">
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
          <div data-protect-writes-detail style="color:#666;font-size:0.84em;margin-top:3px;">Protected: other devices may read from this installation, but may not write changes into it.</div>
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
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin:8px 0 10px;">
        <label style="display:flex;flex-direction:column;font-size:0.9em;gap:4px;">Connection Type
          <select data-sync-transport style="padding:7px;border:1px solid #bbb;border-radius:6px;min-width:150px;">
            <option value="wireless">Wireless / LAN</option>
            <option value="usb">USB Network</option>
            <option value="offline-package">Offline Package</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:0.9em;gap:4px;flex:1;min-width:230px;">Peer URL
          <input data-peer-url type="url" inputmode="url" style="padding:7px;border:1px solid #bbb;border-radius:6px;width:100%;box-sizing:border-box;">
        </label>
      </div>
      <div data-usb-help style="display:none;margin:0 0 10px;padding:8px 10px;border-radius:6px;background:#eef6ff;color:#24527a;font-size:0.82em;line-height:1.35;">USB Network mode uses normal Nodevision peer sync over an operating-system network interface created by USB, Thunderbolt, USB tethering, or a USB Ethernet adapter. If no USB network interface exists, Nodevision cannot discover the peer.</div>
      <div data-offline-help style="display:none;margin:0 0 10px;padding:8px 10px;border-radius:6px;background:#f4f0ff;color:#4b367c;font-size:0.82em;line-height:1.35;">Offline Package mode exports signed sync bundles that can be moved by USB drive, external disk, SD card, or another trusted physical medium without using wireless networking.</div>
      <div data-usb-diagnostics style="display:none;margin:0 0 10px;padding:8px 10px;border-radius:6px;background:#f8fbff;border:1px solid #d6e6f7;color:#24425f;font-size:0.8em;line-height:1.35;"></div>
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
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="font-weight:600;">Offline Transfer</div>
        <span style="font-size:0.78em;color:#666;">Export, import, or push a signed sync package</span>
      </div>
      <div style="margin:0 0 10px;color:#555;font-size:0.82em;line-height:1.35;">Direct Offline Push writes a sync package into a mounted receiver folder. It does not use Wi-Fi, Bluetooth, IP networking, or peer discovery. The receiving computer must expose or mount a writable folder, then import the package from its Offline Sync Inbox.</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <button type="button" data-package-export style="border:1px solid #777;border-radius:6px;background:#fff;padding:7px 10px;cursor:pointer;font-size:0.88em;">Export Package to File</button>
        <button type="button" data-package-import style="border:1px solid #777;border-radius:6px;background:#fff;padding:7px 10px;cursor:pointer;font-size:0.88em;">Import Package from File</button>
        <input data-package-file type="file" accept=".nodevisionsync,.nodevisionsync.zip,.zip,application/zip,application/octet-stream" style="display:none;">
      </div>
      <div style="margin-top:12px;border-top:1px solid #eee;padding-top:10px;display:flex;flex-direction:column;gap:8px;">
        <div style="font-weight:600;font-size:0.9em;">Push Package to Mounted Receiver</div>
        <label style="display:flex;flex-direction:column;font-size:0.86em;gap:4px;">Receiver Drop Folder
          <input data-receiver-drop-path type="text" placeholder="/mounted/path/OfflineSyncInbox" style="padding:7px;border:1px solid #bbb;border-radius:6px;width:100%;box-sizing:border-box;">
        </label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
          <button type="button" data-push-preview style="border:1px solid #777;border-radius:6px;background:#fff;padding:7px 10px;cursor:pointer;font-size:0.88em;">Preview Push</button>
          <button type="button" data-push-package style="border:none;border-radius:6px;background:#0a84ff;color:#fff;padding:8px 12px;cursor:pointer;font-size:0.88em;">Write Package</button>
        </div>
        <div data-push-status style="color:#555;font-size:0.82em;"></div>
      </div>
      <div style="margin-top:12px;border-top:1px solid #eee;padding-top:10px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="font-weight:600;font-size:0.9em;">Incoming Packages</div>
          <button type="button" data-inbox-refresh style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:5px 9px;cursor:pointer;font-size:0.82em;">Refresh Inbox</button>
        </div>
        <select data-inbox-list size="4" style="width:100%;box-sizing:border-box;border:1px solid #bbb;border-radius:6px;padding:6px;font-size:0.84em;"></select>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
          <button type="button" data-inbox-preview style="border:1px solid #777;border-radius:6px;background:#fff;padding:7px 10px;cursor:pointer;font-size:0.88em;">Preview Selected</button>
          <button type="button" data-inbox-import style="border:none;border-radius:6px;background:#2e8b57;color:#fff;padding:8px 12px;cursor:pointer;font-size:0.88em;">Import Selected</button>
        </div>
        <div data-inbox-status style="color:#555;font-size:0.82em;"></div>
      </div>
      <div data-package-status style="margin-top:7px;color:#555;font-size:0.82em;"></div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">
        <label style="display:flex;flex-direction:column;font-size:0.9em;gap:4px;">Scope
          <select data-scope-select style="padding:7px;border:1px solid #bbb;border-radius:6px;min-width:150px;"></select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:0.9em;gap:4px;">Direction
          <select data-sync-direction style="padding:7px;border:1px solid #bbb;border-radius:6px;min-width:170px;">
            <option value="pull">Pull from peer</option>
            <option value="push">Push to peer</option>
            <option value="sync">Two-way sync</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:0.9em;gap:4px;">Max file size (MB)
          <input data-sync-max-file-mb type="number" min="0" step="1" placeholder="No limit" style="padding:7px;border:1px solid #bbb;border-radius:6px;min-width:130px;">
          <span style="font-size:0.78em;color:#666;">Blank or 0 syncs all sizes.</span>
        </label>
        <label style="display:flex;gap:6px;align-items:center;font-size:0.86em;color:#444;padding-bottom:8px;">
          <input type="checkbox" data-sync-pause-on-error>
          <span>Pause on file errors</span>
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
      <div data-job-pause-card style="display:none;margin-top:8px;border:1px solid #e1b24f;border-radius:8px;background:#fff8e8;padding:9px;color:#4d3710;font-size:0.84em;"></div>
      <div data-job-skipped style="display:none;margin-top:8px;border:1px solid #d8d8d8;border-radius:8px;background:#fff;padding:8px;font-size:0.82em;color:#333;"></div>
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
  </div>
`;

const escapeHtml = (v = "") => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const shortenDeviceId = (id = "") => (String(id).length <= 16 ? String(id) : `${String(id).slice(0, 8)}...${String(id).slice(-6)}`);
const shortenJobId = (id = "") => { const text = String(id); return text.length <= 14 ? text : text.slice(0, 8) + "..."; };
const setStatus = (el, msg = "") => { if (el) el.textContent = String(msg); };
function setError(el, msg = "") { if (!el) return; const t = String(msg || "").trim(); el.style.display = t ? "block" : "none"; el.textContent = t; }
function logSyncPanelDebug(message, details = {}) { try { console.debug("[SyncPanel] " + String(message || ""), details); } catch {} }

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

function normalizeMaxFileSizeMb(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const mb = Number(text);
  if (!Number.isFinite(mb) || mb <= 0) return null;
  return Math.min(Math.trunc(mb * 100) / 100, 1048576);
}

const SYNC_MAX_FILE_SIZE_MB_STORAGE_KEY = "nodevision.sync.maxFileSizeMb";
const SYNC_PAUSE_ON_FILE_ERROR_STORAGE_KEY = "nodevision.sync.pauseOnFileError";
const SYNC_DIRECTION_STORAGE_KEY = "nodevision.sync.direction";
const SYNC_TRANSPORT_STORAGE_KEY = "nodevision.sync.syncTransport";
const SYNC_PEER_URL_STORAGE_KEY = "nodevision.sync.peerUrl";
const SYNC_WIRELESS_PEER_URL_STORAGE_KEY = "nodevision.sync.wirelessPeerUrl";
const SYNC_USB_PEER_URL_STORAGE_KEY = "nodevision.sync.usbPeerUrl";
const OFFLINE_RECEIVER_DROP_PATH_STORAGE_KEY = "nodevision.sync.offlineReceiverDropPath";
const WIRELESS_PEER_URL_PLACEHOLDER = "http://10.0.0.42:3000";
const USB_PEER_URL_PLACEHOLDER = "http://192.168.50.2:3000";
const OFFLINE_PEER_URL_PLACEHOLDER = "No peer URL needed";

function readStoredSyncTransportSettings() {
  try {
    const peerUrl = String(window.localStorage?.getItem(SYNC_PEER_URL_STORAGE_KEY) || "").trim();
    let wirelessPeerUrl = String(window.localStorage?.getItem(SYNC_WIRELESS_PEER_URL_STORAGE_KEY) || "").trim();
    if (!wirelessPeerUrl && peerUrl) {
      wirelessPeerUrl = peerUrl;
      window.localStorage?.setItem(SYNC_WIRELESS_PEER_URL_STORAGE_KEY, wirelessPeerUrl);
    }
    return {
      syncTransport: normalizeSyncTransport(window.localStorage?.getItem(SYNC_TRANSPORT_STORAGE_KEY)),
      peerUrl,
      wirelessPeerUrl,
      usbPeerUrl: String(window.localStorage?.getItem(SYNC_USB_PEER_URL_STORAGE_KEY) || "").trim(),
    };
  } catch {
    return { syncTransport: "wireless", peerUrl: "", wirelessPeerUrl: "", usbPeerUrl: "" };
  }
}

function persistSyncTransportSettings(settings = {}) {
  try {
    window.localStorage?.setItem(SYNC_TRANSPORT_STORAGE_KEY, normalizeSyncTransport(settings.syncTransport));
    window.localStorage?.setItem(SYNC_WIRELESS_PEER_URL_STORAGE_KEY, String(settings.wirelessPeerUrl || "").trim());
    window.localStorage?.setItem(SYNC_USB_PEER_URL_STORAGE_KEY, String(settings.usbPeerUrl || "").trim());
  } catch {}
}

function syncTransportLabel(value) {
  const transport = normalizeSyncTransport(value);
  if (transport === "usb") return "USB Network";
  if (transport === "offline-package") return "Offline Package";
  return "Wireless / LAN";
}

function readStoredMaxFileSizeMb() {
  try {
    return normalizeMaxFileSizeMb(window.localStorage?.getItem(SYNC_MAX_FILE_SIZE_MB_STORAGE_KEY));
  } catch {
    return null;
  }
}

function readStoredPauseOnFileError() {
  try {
    return window.localStorage?.getItem(SYNC_PAUSE_ON_FILE_ERROR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function normalizeSyncDirection(value) {
  const direction = String(value || "sync").trim().toLowerCase();
  if (direction === "pull" || direction === "pull-from-peer" || direction === "peer-to-local") return "pull";
  if (direction === "push" || direction === "push-to-peer" || direction === "local-to-peer") return "push";
  if (direction === "sync" || direction === "two-way" || direction === "two-way-sync") return "sync";
  return "sync";
}

function readStoredSyncDirection() {
  try {
    return normalizeSyncDirection(window.localStorage?.getItem(SYNC_DIRECTION_STORAGE_KEY));
  } catch {
    return "sync";
  }
}

function syncDirectionLabel(direction) {
  const normalized = normalizeSyncDirection(direction);
  if (normalized === "pull") return "Pull from peer";
  if (normalized === "push") return "Push to peer";
  return "Two-way sync";
}

function maxFileSizeBytesFromMb(mb) {
  const normalized = normalizeMaxFileSizeMb(mb);
  return normalized === null ? null : Math.trunc(normalized * 1024 * 1024);
}

function isSafeRelativePath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("/") || /^[A-Za-z]:[\\/]/.test(text)) return "";
  if (text.split(/[\\/]+/).includes("ServerSettings")) return "";
  return text;
}


function renderUsbDiagnosticsHtml(diagnostics) {
  if (!diagnostics || typeof diagnostics !== "object") return "";
  const interfaces = Array.isArray(diagnostics.interfaces) ? diagnostics.interfaces : [];
  const candidates = Array.isArray(diagnostics.candidatePeerProbeUrls) ? diagnostics.candidatePeerProbeUrls.slice(0, 10) : [];
  const listening = diagnostics.listening && typeof diagnostics.listening === "object" ? diagnostics.listening : {};
  const interfaceRows = interfaces.length
    ? interfaces.map((item) => `<li>${escapeHtml(item.name || "interface")}: ${escapeHtml(item.address || "")}${item.netmask ? ` / ${escapeHtml(item.netmask)}` : ""}</li>`).join("")
    : `<li>No non-Wi-Fi IPv4 interfaces detected.</li>`;
  const candidateRows = candidates.length
    ? candidates.map((url) => `<li>${escapeHtml(url)}</li>`).join("")
    : `<li>No candidate peer probe URLs available.</li>`;
  const listenText = listening.host
    ? `${String(listening.host)}:${String(listening.port || "?")}${listening.listensOnAllInterfaces ? " (all interfaces)" : listening.loopbackOnly ? " (loopback only)" : ""}`
    : "Unknown";
  const message = String(diagnostics.message || "").trim();
  return `<div><strong>USB Network Diagnostics</strong></div><div>Listening: ${escapeHtml(listenText)}</div><div style="margin-top:4px;">Interfaces:</div><ul style="margin:3px 0 6px;padding-left:18px;">${interfaceRows}</ul><div>Candidate peer probe URLs:</div><ul style="margin:3px 0 0;padding-left:18px;">${candidateRows}</ul>${message ? `<div style="margin-top:6px;color:#8f4f00;">${escapeHtml(message)}</div>` : ""}`;
}

async function fetchJsonWithStatus(url, init = {}) {
  const response = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function createJsonResponseError(response, payload) {
  const status = response && typeof response.status === "number" ? response.status : 0;
  const baseError = String(payload?.error || ("Request failed (" + status + ")")).trim();
  const details = String(payload?.details || "").trim();
  const err = new Error(details ? (baseError + ": " + details) : baseError);
  err.status = status;
  err.payload = payload;
  return err;
}

async function apiFetchJson(url, init = {}) {
  const { response, payload } = await fetchJsonWithStatus(url, init);
  if (!response.ok) {
    throw createJsonResponseError(response, payload);
  }
  return payload;
}

async function apiFetchFormJson(url, formData) {
  const response = await fetch(url, { method: "POST", credentials: "include", body: formData });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createJsonResponseError(response, payload);
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
  const syncTransportSelect = panelElem.querySelector("[data-sync-transport]");
  const peerUrlInput = panelElem.querySelector("[data-peer-url]");
  const usbHelpEl = panelElem.querySelector("[data-usb-help]");
  const offlineHelpEl = panelElem.querySelector("[data-offline-help]");
  const usbDiagnosticsEl = panelElem.querySelector("[data-usb-diagnostics]");
  const scopeSelect = panelElem.querySelector("[data-scope-select]");
  const syncDirectionSelect = panelElem.querySelector("[data-sync-direction]");
  const maxFileSizeInput = panelElem.querySelector("[data-sync-max-file-mb]");
  const pauseOnFileErrorInput = panelElem.querySelector("[data-sync-pause-on-error]");
  const syncDryBtn = panelElem.querySelector("[data-sync-dry]");
  const packageExportBtn = panelElem.querySelector("[data-package-export]");
  const packageImportBtn = panelElem.querySelector("[data-package-import]");
  const packageFileInput = panelElem.querySelector("[data-package-file]");
  const packageStatusEl = panelElem.querySelector("[data-package-status]");
  const receiverDropPathInput = panelElem.querySelector("[data-receiver-drop-path]");
  const pushPreviewBtn = panelElem.querySelector("[data-push-preview]");
  const pushPackageBtn = panelElem.querySelector("[data-push-package]");
  const pushStatusEl = panelElem.querySelector("[data-push-status]");
  const inboxRefreshBtn = panelElem.querySelector("[data-inbox-refresh]");
  const inboxListEl = panelElem.querySelector("[data-inbox-list]");
  const inboxPreviewBtn = panelElem.querySelector("[data-inbox-preview]");
  const inboxImportBtn = panelElem.querySelector("[data-inbox-import]");
  const inboxStatusEl = panelElem.querySelector("[data-inbox-status]");
  const syncApplyBtn = panelElem.querySelector("[data-sync-apply]");
  const syncResultEl = panelElem.querySelector("[data-sync-result]");
  const syncDetailsEl = panelElem.querySelector("[data-sync-details]");
  const foldersRefreshBtn = panelElem.querySelector("[data-folders-refresh]");
  const sharedScopesEl = panelElem.querySelector("[data-shared-scopes]");
  const folderListEl = panelElem.querySelector("[data-folder-list]");
  const jobStatusEl = panelElem.querySelector("[data-job-status]");
  const jobProgressEl = panelElem.querySelector("[data-job-progress]");
  const jobPauseCardEl = panelElem.querySelector("[data-job-pause-card]");
  const jobSkippedEl = panelElem.querySelector("[data-job-skipped]");
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
    status: { discovery: { scanning: false, discoverable: false }, discoveredPeers: [], selectedPeerDeviceId: null, usbNetworkDiagnostics: null },
    scopes: ["SyncTest"],
    candidateFolders: [],
    activeJob: null,
    activeJobId: null,
    syncEvents: [],
    maxFileSizeMb: readStoredMaxFileSizeMb(),
    pauseOnFileError: readStoredPauseOnFileError(),
    syncDirection: readStoredSyncDirection(),
    syncSettings: readStoredSyncTransportSettings(),
    inboxPackages: [],
    selectedInboxPackage: "",
    defaultedProtectedPeerDeviceId: null,
    eventsClearedAt: 0,
    eventsPollTimer: null,
  };

  if (maxFileSizeInput && state.maxFileSizeMb !== null) maxFileSizeInput.value = String(state.maxFileSizeMb);
  if (pauseOnFileErrorInput) pauseOnFileErrorInput.checked = state.pauseOnFileError;
  if (syncDirectionSelect) syncDirectionSelect.value = state.syncDirection;
  if (syncTransportSelect) syncTransportSelect.value = state.syncSettings.syncTransport;
  if (receiverDropPathInput) {
    try { receiverDropPathInput.value = String(window.localStorage?.getItem(OFFLINE_RECEIVER_DROP_PATH_STORAGE_KEY) || ""); } catch {}
  }

  const getMaxFileSizeBytes = () => {
    const mb = normalizeMaxFileSizeMb(maxFileSizeInput?.value);
    state.maxFileSizeMb = mb;
    try {
      if (mb === null) window.localStorage?.removeItem(SYNC_MAX_FILE_SIZE_MB_STORAGE_KEY);
      else window.localStorage?.setItem(SYNC_MAX_FILE_SIZE_MB_STORAGE_KEY, String(mb));
    } catch {}
    if (maxFileSizeInput && mb !== null) maxFileSizeInput.value = String(mb);
    return maxFileSizeBytesFromMb(mb);
  };

  const renderTransportSettings = () => {
    state.syncSettings.syncTransport = normalizeSyncTransport(state.syncSettings.syncTransport);
    const transport = state.syncSettings.syncTransport;
    if (syncTransportSelect && syncTransportSelect.value !== transport) syncTransportSelect.value = transport;
    if (peerUrlInput) {
      peerUrlInput.value = getActivePeerUrl(state.syncSettings);
      peerUrlInput.placeholder = transport === "offline-package" ? OFFLINE_PEER_URL_PLACEHOLDER : transport === "usb" ? USB_PEER_URL_PLACEHOLDER : WIRELESS_PEER_URL_PLACEHOLDER;
      peerUrlInput.disabled = state.busy || transport === "offline-package";
    }
    if (usbHelpEl) usbHelpEl.style.display = transport === "usb" ? "block" : "none";
    if (offlineHelpEl) offlineHelpEl.style.display = transport === "offline-package" ? "block" : "none";
    if (usbDiagnosticsEl) {
      const html = transport === "usb" ? renderUsbDiagnosticsHtml(state.status.usbNetworkDiagnostics) : "";
      usbDiagnosticsEl.style.display = html ? "block" : "none";
      usbDiagnosticsEl.innerHTML = html;
    }
  };

  const setActivePeerUrl = (value) => {
    const peerUrl = String(value || "").trim();
    const transport = normalizeSyncTransport(state.syncSettings.syncTransport);
    if (transport === "offline-package") return;
    if (transport === "usb") state.syncSettings.usbPeerUrl = peerUrl;
    else state.syncSettings.wirelessPeerUrl = peerUrl;
    persistSyncTransportSettings(state.syncSettings);
  };

  const getSelectedPeer = () => {
    const deviceId = state.status.selectedPeerDeviceId;
    return (Array.isArray(state.status.discoveredPeers) ? state.status.discoveredPeers : []).find((peer) => peer?.deviceId === deviceId) || null;
  };

  const autofillPeerUrlFromPeer = (peer) => {
    const result = withActivePeerUrlFromDiscoveredPeer(state.syncSettings, peer);
    state.syncSettings = result.settings;
    persistSyncTransportSettings(state.syncSettings);
    renderTransportSettings();
    return result.peerUrl || "";
  };

  const ensureActivePeerUrlForSelectedPeer = (peer) => {
    const existingPeerUrl = getActivePeerUrl(state.syncSettings);
    if (existingPeerUrl) return existingPeerUrl;
    const discoveredPeerUrl = autofillPeerUrlFromPeer(peer);
    if (discoveredPeerUrl) return discoveredPeerUrl;
    setError(errorEl, "Enter a " + syncTransportLabel(state.syncSettings.syncTransport) + " peer URL.");
    return "";
  };

  const peerRejectsIncomingWrites = (peer) => peer?.capabilities?.acceptsIncomingSyncWrites === false
    || peer?.capabilities?.protectedFromIncomingWrites === true
    || peer?.acceptsIncomingSyncWrites === false
    || peer?.protectedFromIncomingWrites === true;

  const setSyncDirection = (value, { persist = true } = {}) => {
    state.syncDirection = normalizeSyncDirection(value);
    if (syncDirectionSelect) syncDirectionSelect.value = state.syncDirection;
    if (persist) {
      try { window.localStorage?.setItem(SYNC_DIRECTION_STORAGE_KEY, state.syncDirection); } catch {}
    }
    renderSyncDirection();
  };

  const maybeDefaultDirectionForSelectedPeer = () => {
    const selectedPeer = getSelectedPeer();
    if (peerRejectsIncomingWrites(selectedPeer) && state.syncDirection !== "pull" && state.defaultedProtectedPeerDeviceId !== selectedPeer?.deviceId) {
      state.defaultedProtectedPeerDeviceId = selectedPeer?.deviceId || null;
      setSyncDirection("pull");
      setStatus(statusEl, "Selected peer is protected from incoming writes. Direction set to Pull from peer.");
    }
  };

  const renderSyncDirection = () => {
    if (syncDirectionSelect && syncDirectionSelect.value !== state.syncDirection) syncDirectionSelect.value = state.syncDirection;
    if (syncDryBtn) syncDryBtn.textContent = "Dry Run " + syncDirectionLabel(state.syncDirection);
    if (syncApplyBtn) syncApplyBtn.textContent = state.syncDirection === "pull" ? "Start Pull" : state.syncDirection === "push" ? "Start Push" : "Start Sync";
  };

  const syncRunBody = ({ deviceId, scope, dryRun }) => {
    const body = { deviceId, scope, peerUrl: getActivePeerUrl(state.syncSettings), syncTransport: state.syncSettings.syncTransport, dryRun: Boolean(dryRun), syncDirection: state.syncDirection, direction: state.syncDirection };
    const maxFileSizeBytes = getMaxFileSizeBytes();
    if (maxFileSizeBytes !== null) body.maxFileSizeBytes = maxFileSizeBytes;
    body.onFileError = state.pauseOnFileError ? "pause" : "fail";
    return body;
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
        ? "Protected: other devices may read from this installation, but may not write changes into it."
        : "Other devices may read from and write changes into this installation when trusted.";
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
    renderSyncDirection();
    const packageMode = normalizeSyncTransport(state.syncSettings.syncTransport) === "offline-package";
    if (syncDryBtn) syncDryBtn.disabled = state.busy || packageMode;
    if (syncApplyBtn) syncApplyBtn.disabled = state.busy || packageMode;
  };

  const renderDiscoveryButtons = () => {
    if (!scanningBtn || !discoverableBtn) return;
    const scanning = state.status.discovery?.scanning === true;
    const discoverable = state.status.discovery?.discoverable === true;
    const transport = normalizeSyncTransport(state.syncSettings.syncTransport);
    const usbMode = transport === "usb";
    const offlineMode = transport === "offline-package";
    scanningBtn.textContent = offlineMode ? "Peer Scan Unused" : scanning ? "Stop Scanning" : (usbMode ? "Scan USB Network" : "Scan for Devices");
    discoverableBtn.textContent = offlineMode ? "Discoverability Unused" : discoverable ? "Stop Discoverability" : (usbMode ? "Make Discoverable on USB Network" : "Make This Device Discoverable");
    scanningBtn.disabled = state.busy || offlineMode;
    discoverableBtn.disabled = state.busy || offlineMode;
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

  const isFinalJobStatus = (status) => ["complete", "completed", "failed", "cancelled"].includes(String(status || ""));
  const renderSkippedOperations = (job) => {
    if (!jobSkippedEl) return;
    const skipped = Array.isArray(job?.skippedOperations) ? job.skippedOperations : [];
    if (!skipped.length) {
      jobSkippedEl.style.display = "none";
      jobSkippedEl.innerHTML = "";
      return;
    }
    jobSkippedEl.style.display = "block";
    const rows = skipped.slice(0, 25).map((entry) => {
      const path = isSafeRelativePath(entry?.relativePath) || String(entry?.relativePath || "");
      const operation = String(entry?.operation || entry?.type || "file");
      const error = String(entry?.error || "Skipped");
      return `<li style="margin:3px 0;"><strong>${escapeHtml(operation)}:</strong> ${escapeHtml(path)}<br><span style="color:#666;">${escapeHtml(error)}</span></li>`;
    }).join("");
    const more = skipped.length > 25 ? `<div style="margin-top:5px;color:#666;">${escapeHtml(skipped.length - 25)} more skipped operation${skipped.length - 25 === 1 ? "" : "s"} in the job result.</div>` : "";
    jobSkippedEl.innerHTML = `<div style="font-weight:600;margin-bottom:4px;">Skipped files (${escapeHtml(skipped.length)})</div><ul style="margin:0;padding-left:18px;">${rows}</ul>${more}`;
  };
  const renderPauseCard = (job, status) => {
    if (!jobPauseCardEl) return;
    if (status !== "paused") {
      jobPauseCardEl.style.display = "none";
      jobPauseCardEl.innerHTML = "";
      return;
    }
    const op = job.pausedOperation && typeof job.pausedOperation === "object" ? job.pausedOperation : {};
    const err = job.pausedError && typeof job.pausedError === "object" ? job.pausedError : {};
    const relativePath = isSafeRelativePath(op.relativePath || job.currentFile) || String(op.relativePath || job.currentFile || "");
    const statusCode = err.statusCode || op.statusCode || "";
    jobPauseCardEl.style.display = "block";
    jobPauseCardEl.innerHTML = `
      <div style="font-weight:600;margin-bottom:5px;">Sync paused on file error</div>
      <div style="display:grid;gap:3px;">
        <div><strong>File:</strong> ${escapeHtml(relativePath || "Unknown file")}</div>
        <div><strong>Operation:</strong> ${escapeHtml(op.operation || op.type || "file")}</div>
        <div><strong>Error:</strong> ${escapeHtml(err.message || job.pauseReason || "Unknown error")}</div>
        ${statusCode ? `<div><strong>Status:</strong> ${escapeHtml(statusCode)}</div>` : ""}
        <div><strong>Retries:</strong> ${escapeHtml(job.retryCount || op.retryCount || 0)}</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:8px;">
        <button type="button" data-job-retry style="border:1px solid #8a6d1d;border-radius:6px;background:#fff;padding:6px 9px;cursor:pointer;">Retry file</button>
        <button type="button" data-job-skip style="border:1px solid #8a6d1d;border-radius:6px;background:#fff;padding:6px 9px;cursor:pointer;">Skip file and continue</button>
        <button type="button" data-job-abort style="border:1px solid #a33;border-radius:6px;background:#fff4f4;color:#8b1c1c;padding:6px 9px;cursor:pointer;">Abort sync</button>
      </div>`;
  };
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
      renderPauseCard(null, "");
      renderSkippedOperations(null);
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
      const filesSkipped = Number(job.filesSkipped || 0);
      const bytesSkipped = Number(job.bytesSkipped || 0);
      jobProgressEl.textContent = `Files ${filesDone}/${filesTotal} | Skipped ${filesSkipped} | Bytes ${bytesDone}/${bytesTotal} | Bytes skipped ${bytesSkipped}`;
    }
    renderPauseCard(job, status);
    renderSkippedOperations(job);
    const errors = Array.isArray(job.errors) ? job.errors.filter(Boolean) : [];
    if (jobErrorsEl) {
      jobErrorsEl.style.display = errors.length ? "block" : "none";
      jobErrorsEl.textContent = errors.length ? errors.join("\n") : "";
    }
    if (syncCancelBtn) {
      const cancellable = status === "queued" || status === "running" || status === "paused";
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
    [refreshBtn, scanningBtn, discoverableBtn, scopeSelect, syncDirectionSelect, syncTransportSelect, peerUrlInput, maxFileSizeInput, pauseOnFileErrorInput, syncDryBtn, syncApplyBtn, packageExportBtn, packageImportBtn, receiverDropPathInput, pushPreviewBtn, pushPackageBtn, inboxRefreshBtn, inboxListEl, inboxPreviewBtn, inboxImportBtn, foldersRefreshBtn, protectWritesEl, protectEnableBtn, protectDisableBtn].forEach((el) => { if (el) el.disabled = state.busy; });
    renderJob();
    renderProtection();
    renderTransportSettings();
    renderDiscoveryButtons();
    if (statusMessage) setStatus(statusEl, statusMessage);
  };

  const loadLocalDevice = async () => { const p = await apiFetchJson("/api/sync/local-device", { cache: "no-store" }); state.localDevice = p.localDevice || null; renderLocalDevice(); };
  const loadProtection = async () => { const p = await apiFetchJson("/api/sync/protection", { cache: "no-store" }); state.protection = p.protection || { protectedFromPeerWrites: false }; renderProtection(); };
  const loadScopes = async () => { try { const p = await apiFetchJson("/api/sync/scopes", { cache: "no-store" }); state.scopes = Array.isArray(p.syncScopes) && p.syncScopes.length ? p.syncScopes : ["SyncTest"]; } catch { state.scopes = ["SyncTest"]; } renderScopes(); renderSharedScopes(); };
  const loadFolders = async () => { try { const p = await apiFetchJson("/api/sync/notebook-folders", { cache: "no-store" }); state.candidateFolders = Array.isArray(p.folders) ? p.folders : []; } catch { state.candidateFolders = []; } renderCandidateFolders(); };
  const refreshStatus = async () => { const p = await apiFetchJson("/api/sync/status", { cache: "no-store" }); state.status = { discovery: p.discovery || { scanning: false, discoverable: false }, discoveredPeers: Array.isArray(p.discoveredPeers) ? p.discoveredPeers : [], selectedPeerDeviceId: p.selectedPeerDeviceId || null, usbNetworkDiagnostics: p.usbNetworkDiagnostics || null }; state.protection = p.protection || state.protection; maybeDefaultDirectionForSelectedPeer(); renderDiscoveryButtons(); renderPeers(); renderProtection(); renderTransportSettings(); };
  const refreshActiveJob = async () => {
    const jobId = String(state.activeJobId || "").trim();
    if (!jobId) return;
    const currentStatus = String(state.activeJob?.status || "");
    if (isFinalJobStatus(currentStatus)) return;
    const payload = await apiFetchJson(`/api/sync/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    state.activeJob = payload.job || null;
    renderJob();
    if (syncResultEl && state.activeJob && isFinalJobStatus(state.activeJob.status)) {
      const completed = state.activeJob.status === "complete" || state.activeJob.status === "completed";
      syncResultEl.textContent = JSON.stringify({ ok: completed, partial: Number(state.activeJob.filesSkipped || 0) > 0, job: state.activeJob }, null, 2);
      if (syncDetailsEl) syncDetailsEl.open = true;
      setStatus(statusEl, completed ? (Number(state.activeJob.filesSkipped || 0) > 0 ? "Sync job completed with skipped files." : "Sync job completed.") : `Sync job ${state.activeJob.status}.`);
    }
  };

  const runToggle = async (url, enabled, label) => {
    setError(errorEl, "");
    setBusy(true, `${label}...`);
    try {
      await apiFetchJson(url, {
        method: "POST",
        body: JSON.stringify({
          enabled,
          syncTransport: state.syncSettings.syncTransport,
          peerUrl: getActivePeerUrl(state.syncSettings),
        }),
      });
      await refreshStatus();
      setStatus(statusEl, `${label} complete.`);
    } catch (err) {
      setError(errorEl, err?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };
  const shareScope = async (scope) => { setBusy(true, "Adding shared folder..."); try { await apiFetchJson("/api/sync/scopes", { method: "POST", body: JSON.stringify({ scope }) }); await Promise.all([loadScopes(), loadFolders()]); } catch (err) { setError(errorEl, err?.message || "Failed to add scope"); } finally { setBusy(false); } };
  const unshareScope = async (scope) => { setBusy(true, "Removing shared folder..."); try { await apiFetchJson("/api/sync/scopes", { method: "DELETE", body: JSON.stringify({ scope }) }); await Promise.all([loadScopes(), loadFolders()]); } catch (err) { setError(errorEl, err?.message || "Failed to remove scope"); } finally { setBusy(false); } };
  const toggleProtection = async (enabled) => { setBusy(true, "Updating sync protection..."); try { const p = await apiFetchJson("/api/sync/protection", { method: "POST", body: JSON.stringify({ protectedFromPeerWrites: Boolean(enabled) }) }); state.protection = p.protection || { protectedFromPeerWrites: Boolean(enabled) }; renderProtection(); setStatus(statusEl, state.protection.protectedFromPeerWrites ? "This installation is protected from sync writes." : "Sync write protection disabled."); } catch (err) { setError(errorEl, err?.message || "Failed to update sync protection"); renderProtection(); } finally { setBusy(false); } };


  const setPackageStatus = (message = "", options = {}) => {
    if (!packageStatusEl) return;
    if (options.html === true) packageStatusEl.innerHTML = String(message || "");
    else packageStatusEl.textContent = String(message || "");
  };

  const packageRecords = (result, key) => Array.isArray(result && result[key]) ? result[key] : [];

  const renderPackageRecordList = (label, records, pathKey = "relativePath") => {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) return "";
    const rows = list.slice(0, 8).map((entry) => {
      const path = (entry && (entry[pathKey] || entry.relativePath || entry.originalRelativePath)) || "";
      const reason = (entry && (entry.reason || entry.error)) || "";
      return "<li>" + escapeHtml(path) + (reason ? " (" + escapeHtml(reason) + ")" : "") + "</li>";
    }).join("");
    const more = list.length > 8 ? "<li>" + escapeHtml(list.length - 8) + " more...</li>" : "";
    return "<div style=\"margin-top:6px;\"><strong>" + escapeHtml(label) + " (" + escapeHtml(list.length) + ")</strong><ul style=\"margin:3px 0 0;padding-left:18px;\">" + rows + more + "</ul></div>";
  };

  const renderPackageResultHtml = (result = {}, phase = "preview") => {
    const counts = result.counts || {};
    const countValue = (primary, alias) => Number(counts[primary] !== undefined ? counts[primary] : (alias && counts[alias] !== undefined ? counts[alias] : 0));
    const notices = [];
    if (result.packageValid === false || result.packageValidity?.valid === false) notices.push("This package is invalid or contains unsafe paths.");
    if (result.signatureVerified === false || result.signatureValid === false) notices.push("This package is invalid or unsigned: its signature could not be verified.");
    if ((result.signatureVerified === true || result.signatureValid === true) && result.trusted !== true) notices.push("This package is signed but not from a trusted peer.");
    if (result.reason === "target_scope_mismatch") notices.push("This package is from a trusted peer but targets a different scope.");
    if (result.protectedMode?.blocked === true) notices.push("Protected mode prevents this import.");
    if (phase === "import" && packageRecords(result, "conflicts").length) notices.push("Some files conflict and were copied to .conflicts.");
    if (phase === "import" && result.ok !== false && !notices.length) notices.push("Import completed successfully.");
    if (phase === "preview" && result.ok !== false && !notices.length) notices.push("Package preview is ready to import.");
    const summary = [
      "Created " + countValue("created", "wouldCreate"),
      "Updated " + countValue("updated", "wouldUpdate"),
      "Skipped " + countValue("skipped"),
      "Conflicts " + countValue("conflicts", "wouldSaveConflicts"),
      "Blocked " + countValue("blocked"),
      "Errors " + countValue("errors"),
    ].join(" | ");
    const noticeHtml = notices.map((notice) => "<div style=\"margin-top:4px;\">" + escapeHtml(notice) + "</div>").join("");
    const errors = (Array.isArray(result.errors) ? result.errors : []).map((error) => ({ relativePath: String(error), reason: "error" }));
    return "<div style=\"font-weight:600;margin-bottom:4px;\">" + escapeHtml(phase === "import" ? "Offline Package Import" : "Offline Package Preview") + ": " + escapeHtml(result.status || (result.ok === false ? "blocked" : "ready")) + "</div>"
      + "<div>" + escapeHtml(summary) + "</div>"
      + noticeHtml
      + renderPackageRecordList("Created", packageRecords(result, "created"))
      + renderPackageRecordList("Updated", packageRecords(result, "updated"))
      + renderPackageRecordList("Skipped", packageRecords(result, "skipped"))
      + renderPackageRecordList("Conflicts", packageRecords(result, "conflicts"), "originalRelativePath")
      + renderPackageRecordList("Blocked", packageRecords(result, "blocked"))
      + renderPackageRecordList("Errors", errors);
  };

  const showPackageResult = (result, phase = "preview") => {
    if (syncResultEl) syncResultEl.textContent = JSON.stringify(result, null, 2);
    if (syncDetailsEl) syncDetailsEl.open = true;
    setPackageStatus(renderPackageResultHtml(result, phase), { html: true });
  };

  const selectedPackageScope = () => scopeSelect?.value || "SyncTest";

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "nodevision.nodevisionsync";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportSyncPackage = async () => {
    const scope = selectedPackageScope();
    setError(errorEl, "");
    setPackageStatus("");
    setBusy(true, "Exporting sync package...");
    try {
      const response = await fetch(`/api/sync/package/export?scope=${encodeURIComponent(scope)}`, { credentials: "include" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw createJsonResponseError(response, payload);
      }
      const blob = await response.blob();
      const disposition = String(response.headers.get("content-disposition") || "");
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match ? match[1] : `${scope.split("/").pop() || "notebook"}.nodevisionsync`;
      downloadBlob(blob, filename);
      const count = String(response.headers.get("x-nodevision-sync-files") || "").trim();
      setPackageStatus(count ? `Exported ${count} file${count === "1" ? "" : "s"} to ${filename}.` : `Exported ${filename}.`);
      setStatus(statusEl, "Sync package exported.");
    } catch (err) {
      setError(errorEl, err?.message || "Failed to export sync package");
    } finally {
      setBusy(false);
    }
  };

  const importSyncPackageFile = async (file) => {
    if (!file) return;
    setError(errorEl, "");
    setPackageStatus("");
    setBusy(true, "Previewing sync package...");
    try {
      const previewForm = new FormData();
      previewForm.append("package", file);
      previewForm.append("scope", selectedPackageScope());
      const preview = await apiFetchFormJson("/api/sync/package/preview", previewForm);
      showPackageResult(preview, "preview");
      if (preview.ok === false || preview.status === "blocked") {
        setStatus(statusEl, "Sync package preview blocked.");
        return;
      }

      const counts = preview.counts || {};
      const confirmed = window.confirm(
        "Import sync package from " + String(preview.sourceDevice?.deviceName || "Unknown Device")
          + " into " + String(preview.targetScope || preview.scope || "scope") + "?\n\n"
          + "Created: " + Number(counts.created || counts.wouldCreate || 0) + "\n"
          + "Updated: " + Number(counts.updated || counts.wouldUpdate || 0) + "\n"
          + "Conflicts: " + Number(counts.conflicts || counts.wouldSaveConflicts || 0) + "\n"
          + "Skipped: " + Number(counts.skipped || 0),
      );
      if (!confirmed) {
        setPackageStatus("Import cancelled after preview.");
        return;
      }

      setBusy(true, "Importing sync package...");
      const importForm = new FormData();
      importForm.append("package", file);
      importForm.append("scope", selectedPackageScope());
      const imported = await apiFetchFormJson("/api/sync/package/import", importForm);
      showPackageResult(imported, "import");
      if (imported.ok === false || imported.status === "blocked" || imported.status === "failed") {
        setStatus(statusEl, "Sync package import blocked.");
        return;
      }
      setStatus(statusEl, imported.partial ? "Sync package imported with skipped or blocked files." : "Sync package imported.");
      await Promise.all([loadScopes(), loadFolders(), refreshStatus()]).catch(() => {});
    } catch (err) {
      if (err?.payload && typeof err.payload === "object") {
        showPackageResult(err.payload, err.payload.imported === false ? "import" : "preview");
      }
      setError(errorEl, err?.message || "Failed to import sync package");
    } finally {
      if (packageFileInput) packageFileInput.value = "";
      setBusy(false);
    }
  };


  const formatPackageBytes = (bytes) => {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value < 0) return "0 B";
    if (value < 1024) return `${Math.trunc(value)} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
    return `${Math.round(value / 1024 / 102.4) / 10} MB`;
  };

  const setPushStatus = (message = "", options = {}) => {
    if (!pushStatusEl) return;
    if (options.html === true) pushStatusEl.innerHTML = String(message || "");
    else pushStatusEl.textContent = String(message || "");
  };

  const setInboxStatus = (message = "", options = {}) => {
    if (!inboxStatusEl) return;
    if (options.html === true) inboxStatusEl.innerHTML = String(message || "");
    else inboxStatusEl.textContent = String(message || "");
  };

  const receiverDropPath = () => String(receiverDropPathInput?.value || "").trim();

  const persistReceiverDropPath = () => {
    try { window.localStorage?.setItem(OFFLINE_RECEIVER_DROP_PATH_STORAGE_KEY, receiverDropPath()); } catch {}
  };

  const renderPushResultHtml = (result = {}, phase = "preview") => {
    const receiverName = result.receiver?.deviceName ? `Receiver identified as: ${result.receiver.deviceName}` : "Receiver not identified";
    const warnings = Array.isArray(result.warnings) ? result.warnings : [];
    const warningHtml = warnings.map((warning) => `<div style="margin-top:4px;color:#8f4f00;">${escapeHtml(warning)}</div>`).join("");
    const fileCount = Number(result.estimatedFileCount || 0);
    const fileLine = `${fileCount} file${fileCount === 1 ? "" : "s"}, ${formatPackageBytes(result.estimatedByteCount || 0)}`;
    const writtenLine = result.packageFilename ? `<div style="margin-top:4px;">Package: ${escapeHtml(result.packageFilename)}</div>` : "";
    const messageLine = result.message ? `<div style="margin-top:4px;">${escapeHtml(result.message)}</div>` : "";
    return `<div style="font-weight:600;margin-bottom:4px;">${phase === "write" ? "Mounted Receiver Package Written" : "Mounted Receiver Push Preview"}</div>`
      + `<div>Scope ${escapeHtml(result.scope || selectedPackageScope())} | ${escapeHtml(fileLine)}</div>`
      + `<div style="margin-top:4px;">${escapeHtml(receiverName)}</div>`
      + `<div style="margin-top:4px;">Receiver Drop Folder: ${escapeHtml(result.receiverDropPath || receiverDropPath())}</div>`
      + warningHtml
      + writtenLine
      + messageLine;
  };

  const previewMountedPush = async () => {
    persistReceiverDropPath();
    setError(errorEl, "");
    setPushStatus("");
    setBusy(true, "Previewing mounted receiver push...");
    try {
      const preview = await apiFetchJson("/api/sync/offline/push-preview", {
        method: "POST",
        body: JSON.stringify({ scope: selectedPackageScope(), receiverDropPath: receiverDropPath() }),
      });
      if (syncResultEl) syncResultEl.textContent = JSON.stringify(preview, null, 2);
      if (syncDetailsEl) syncDetailsEl.open = true;
      setPushStatus(renderPushResultHtml(preview, "preview"), { html: true });
      setStatus(statusEl, "Mounted receiver push preview ready.");
    } catch (err) {
      setError(errorEl, err?.message || "Failed to preview mounted receiver push");
    } finally {
      setBusy(false);
    }
  };

  const writeMountedPush = async () => {
    persistReceiverDropPath();
    setError(errorEl, "");
    setPushStatus("");
    setBusy(true, "Writing package to mounted receiver...");
    try {
      const written = await apiFetchJson("/api/sync/offline/push-package", {
        method: "POST",
        body: JSON.stringify({ scope: selectedPackageScope(), receiverDropPath: receiverDropPath() }),
      });
      if (syncResultEl) syncResultEl.textContent = JSON.stringify(written, null, 2);
      if (syncDetailsEl) syncDetailsEl.open = true;
      setPushStatus(renderPushResultHtml(written, "write"), { html: true });
      setStatus(statusEl, written.message || "Package was written successfully.");
    } catch (err) {
      setError(errorEl, err?.message || "Failed to write package to mounted receiver");
    } finally {
      setBusy(false);
    }
  };

  const renderInboxPackages = () => {
    if (!inboxListEl) return;
    const selected = state.selectedInboxPackage || inboxListEl.value;
    inboxListEl.innerHTML = "";
    const packages = Array.isArray(state.inboxPackages) ? state.inboxPackages : [];
    if (!packages.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No complete offline sync packages found.";
      inboxListEl.appendChild(option);
      inboxListEl.value = "";
      state.selectedInboxPackage = "";
      return;
    }
    for (const item of packages) {
      const option = document.createElement("option");
      option.value = item.filename || "";
      const deviceName = item.sourceDevice?.deviceName || "Unknown device";
      const scope = item.scope || "unknown scope";
      const trust = item.trustStatus || "unknown";
      option.textContent = `${item.filename} | ${scope} | ${deviceName} | ${formatPackageBytes(item.size)} | ${trust}`;
      inboxListEl.appendChild(option);
    }
    inboxListEl.value = packages.some((item) => item.filename === selected) ? selected : (packages[0]?.filename || "");
    state.selectedInboxPackage = inboxListEl.value;
  };

  const refreshInbox = async () => {
    setError(errorEl, "");
    setBusy(true, "Refreshing Offline Sync Inbox...");
    try {
      const inbox = await apiFetchJson("/api/sync/offline/inbox", { cache: "no-store" });
      state.inboxPackages = Array.isArray(inbox.packages) ? inbox.packages : [];
      renderInboxPackages();
      const count = state.inboxPackages.length;
      const receiver = inbox.marker?.deviceName ? ` Local inbox: ${inbox.marker.deviceName}.` : "";
      setInboxStatus(`${count} complete package${count === 1 ? "" : "s"} in Offline Sync Inbox.${receiver}`);
    } catch (err) {
      setError(errorEl, err?.message || "Failed to refresh Offline Sync Inbox");
    } finally {
      setBusy(false);
    }
  };

  const selectedInboxFilename = () => String(inboxListEl?.value || state.selectedInboxPackage || "").trim();

  const previewInboxSelected = async () => {
    const filename = selectedInboxFilename();
    if (!filename) return setInboxStatus("Select an incoming package first.");
    setError(errorEl, "");
    setBusy(true, "Previewing inbox package...");
    try {
      const preview = await apiFetchJson("/api/sync/offline/inbox/preview", {
        method: "POST",
        body: JSON.stringify({ filename, scope: selectedPackageScope() }),
      });
      showPackageResult(preview, "preview");
      setInboxStatus(preview.ok === false || preview.status === "blocked" ? "Inbox package preview blocked." : "Inbox package preview ready.");
    } catch (err) {
      if (err?.payload && typeof err.payload === "object") showPackageResult(err.payload, "preview");
      setError(errorEl, err?.message || "Failed to preview inbox package");
    } finally {
      setBusy(false);
    }
  };

  const importInboxSelected = async () => {
    const filename = selectedInboxFilename();
    if (!filename) return setInboxStatus("Select an incoming package first.");
    setError(errorEl, "");
    setBusy(true, "Previewing inbox package...");
    try {
      const preview = await apiFetchJson("/api/sync/offline/inbox/preview", {
        method: "POST",
        body: JSON.stringify({ filename, scope: selectedPackageScope() }),
      });
      showPackageResult(preview, "preview");
      if (preview.ok === false || preview.status === "blocked") {
        setInboxStatus("Inbox package preview blocked.");
        setStatus(statusEl, "Sync package preview blocked.");
        return;
      }
      const counts = preview.counts || {};
      const confirmed = window.confirm(
        "Import selected inbox package from " + String(preview.sourceDevice?.deviceName || "Unknown Device")
          + " into " + String(preview.targetScope || preview.scope || "scope") + "?\n\n"
          + "Created: " + Number(counts.created || counts.wouldCreate || 0) + "\n"
          + "Updated: " + Number(counts.updated || counts.wouldUpdate || 0) + "\n"
          + "Conflicts: " + Number(counts.conflicts || counts.wouldSaveConflicts || 0) + "\n"
          + "Skipped: " + Number(counts.skipped || 0),
      );
      if (!confirmed) {
        setInboxStatus("Inbox import cancelled after preview.");
        return;
      }
      setBusy(true, "Importing inbox package...");
      const imported = await apiFetchJson("/api/sync/offline/inbox/import", {
        method: "POST",
        body: JSON.stringify({ filename, scope: selectedPackageScope() }),
      });
      showPackageResult(imported, "import");
      if (imported.ok === false || imported.status === "blocked" || imported.status === "failed") {
        setInboxStatus("Inbox package import blocked.");
        setStatus(statusEl, "Sync package import blocked.");
        return;
      }
      setInboxStatus("Inbox package imported and moved to Imported.");
      setStatus(statusEl, imported.partial ? "Sync package imported with skipped or blocked files." : "Sync package imported.");
      await Promise.all([loadScopes(), loadFolders(), refreshStatus(), refreshInbox()]).catch(() => {});
    } catch (err) {
      if (err?.payload && typeof err.payload === "object") showPackageResult(err.payload, err.payload.imported === false ? "import" : "preview");
      setError(errorEl, err?.message || "Failed to import inbox package");
    } finally {
      setBusy(false);
    }
  };


  const runSync = async (dryRun) => {
    const scope = scopeSelect?.value || "SyncTest";
    const deviceId = state.status.selectedPeerDeviceId;
    const selectedPeer = getSelectedPeer();
    const protectedOn = state.protection?.protectedFromPeerWrites === true;
    const direction = state.syncDirection;
    const mode = dryRun ? "dry-run" : "apply";
    let requestOptions = null;
    let jobCreationRequestSent = false;

    if (!dryRun) {
      logSyncPanelDebug("Apply Sync button clicked", {
        protectedFromPeerWrites: protectedOn,
        selectedPeerDeviceId: deviceId || null,
        selectedPeer: selectedPeer ? {
          deviceId: selectedPeer.deviceId || null,
          deviceName: selectedPeer.deviceName || null,
          trusted: selectedPeer.trusted === true,
          syncCapable: selectedPeer?.capabilities?.sync === true,
        } : null,
        selectedScope: scope,
        direction,
        mode,
        requestedSyncOptions: requestOptions,
        jobCreationRequestSent: false,
      });
    }

    if (normalizeSyncTransport(state.syncSettings.syncTransport) === "offline-package") {
      return setError(errorEl, "Offline Package mode uses Export Sync Package and Import Sync Package instead of peer sync.");
    }

    if (!deviceId) {
      if (!dryRun) logSyncPanelDebug("Apply Sync blocked before request", { reason: "no_selected_peer", jobCreationRequestSent: false });
      return setError(errorEl, "Select a discovered peer before running sync.");
    }
    if (!selectedPeer || selectedPeer.trusted !== true || selectedPeer?.capabilities?.sync !== true) {
      if (!dryRun) logSyncPanelDebug("Apply Sync blocked before request", { reason: "peer_not_trusted_or_sync_capable", jobCreationRequestSent: false });
      return setError(errorEl, "Only trusted sync-capable peers can be selected for sync.");
    }

    const activePeerUrl = ensureActivePeerUrlForSelectedPeer(selectedPeer);
    if (!activePeerUrl) {
      if (!dryRun) logSyncPanelDebug("Apply Sync blocked before request", { reason: "missing_peer_url", transport: state.syncSettings.syncTransport, selectedPeerDeviceId: deviceId || null, jobCreationRequestSent: false });
      return;
    }

    requestOptions = syncRunBody({ deviceId, scope, dryRun });
    if (!dryRun) {
      logSyncPanelDebug("Apply Sync options prepared", {
        protectedFromPeerWrites: protectedOn,
        selectedPeerDeviceId: deviceId || null,
        selectedPeer: selectedPeer.deviceId || null,
        selectedScope: scope,
        direction,
        mode,
        requestedSyncOptions: requestOptions,
        jobCreationRequestSent: false,
      });
    }

    setError(errorEl, "");
    try {
      if (!dryRun) {
        setBusy(true, "Running preflight checks...");
        const preflight = await apiFetchJson("/api/sync/preflight", { method: "POST", body: JSON.stringify({ ...requestOptions, dryRun: true }) });
        if (syncResultEl) syncResultEl.textContent = JSON.stringify(preflight, null, 2);
        if (syncDetailsEl) syncDetailsEl.open = true;
        setBusy(true, "Starting sync job...");
        jobCreationRequestSent = true;
        logSyncPanelDebug("Apply Sync job creation request sent", {
          protectedFromPeerWrites: protectedOn,
          selectedPeerDeviceId: deviceId || null,
          selectedPeer: selectedPeer.deviceId || null,
          selectedScope: scope,
          direction,
          mode,
          requestedSyncOptions: requestOptions,
          jobCreationRequestSent: true,
        });
        const startedResult = await fetchJsonWithStatus("/api/sync/jobs/start", { method: "POST", body: JSON.stringify(requestOptions) });
        const started = startedResult.payload;
        logSyncPanelDebug("Apply Sync job creation response received", {
          protectedFromPeerWrites: protectedOn,
          selectedPeerDeviceId: deviceId || null,
          selectedPeer: selectedPeer.deviceId || null,
          selectedScope: scope,
          direction,
          mode,
          requestedSyncOptions: requestOptions,
          jobCreationRequestSent: true,
          responseStatus: startedResult.response.status,
          responseBody: started,
        });
        if (!startedResult.response.ok) throw createJsonResponseError(startedResult.response, started);
        state.activeJobId = started.jobId || null;
        state.activeJob = started.job || null;
        renderJob();
        await refreshActiveJob().catch(() => {});
        setStatus(statusEl, "Sync job started.");
        return;
      }
      setBusy(true, dryRun ? "Running dry-run sync..." : "Running sync...");
      const payload = await apiFetchJson("/api/sync/run", { method: "POST", body: JSON.stringify(requestOptions) });
      if (syncResultEl) syncResultEl.textContent = JSON.stringify(payload, null, 2);
      if (syncDetailsEl) syncDetailsEl.open = true;
      await refreshStatus();
      setStatus(statusEl, dryRun ? "Dry-run sync completed." : "Sync completed.");
    } catch (err) {
      if (!dryRun) {
        logSyncPanelDebug("Apply Sync failed", {
          protectedFromPeerWrites: protectedOn,
          selectedPeerDeviceId: deviceId || null,
          selectedPeer: selectedPeer?.deviceId || null,
          selectedScope: scope,
          direction,
          mode,
          requestedSyncOptions: requestOptions,
          jobCreationRequestSent,
          error: err?.message || "Sync failed",
          responseStatus: err?.status || null,
          responseBody: err?.payload || null,
        });
      }
      const msg = String(err?.message || "Sync failed");
      if (msg.includes("Scope is not enabled:")) {
        setError(errorEl, msg + ". Scope \"" + scope + "\" must be shared on both devices before sync can run.");
      } else if (msg.includes("Scope not yet supported")) {
        setError(errorEl, "This scope is configured, but generalized sync execution is not enabled yet.");
      } else {
        setError(errorEl, msg);
      }
    } finally { setBusy(false); }
  };


  renderTransportSettings();

  syncTransportSelect?.addEventListener("change", () => {
    state.syncSettings.syncTransport = normalizeSyncTransport(syncTransportSelect.value);
    const selectedPeer = getSelectedPeer();
    if (selectedPeer) autofillPeerUrlFromPeer(selectedPeer);
    else persistSyncTransportSettings(state.syncSettings);
    renderTransportSettings();
    renderDiscoveryButtons();
    renderProtection();
    setError(errorEl, "");
  });
  peerUrlInput?.addEventListener("input", () => { setActivePeerUrl(peerUrlInput.value); });
  peerUrlInput?.addEventListener("change", () => { setActivePeerUrl(peerUrlInput.value); renderTransportSettings(); });

  maxFileSizeInput?.addEventListener("change", () => { getMaxFileSizeBytes(); });
  syncDirectionSelect?.addEventListener("change", () => {
    setSyncDirection(syncDirectionSelect.value);
    const selectedPeer = getSelectedPeer();
    if (peerRejectsIncomingWrites(selectedPeer) && state.syncDirection !== "pull") {
      setStatus(statusEl, "Selected peer is protected from incoming writes. Preflight will block Push or Two-way Sync.");
    }
  });
  pauseOnFileErrorInput?.addEventListener("change", () => {
    state.pauseOnFileError = Boolean(pauseOnFileErrorInput.checked);
    try { window.localStorage?.setItem(SYNC_PAUSE_ON_FILE_ERROR_STORAGE_KEY, state.pauseOnFileError ? "true" : "false"); } catch {}
  });

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
      const peerUrl = autofillPeerUrlFromPeer(getSelectedPeer() || selectedPeer);
      const peerName = String(selectedPeer.deviceName || "peer");
      setStatus(statusEl, peerUrl ? "Selected " + peerName + ". Peer URL set to " + peerUrl + "." : "Selected " + peerName + ".");
    } catch (err) {
      setError(errorEl, err?.message || "Unable to select peer");
    }
  });
  refreshBtn?.addEventListener("click", () => Promise.all([loadProtection(), loadScopes(), loadFolders(), refreshStatus()]).catch((err) => setError(errorEl, err?.message || "Refresh failed")));
  scanningBtn?.addEventListener("click", () => {
    const usbMode = normalizeSyncTransport(state.syncSettings.syncTransport) === "usb";
    runToggle("/api/sync/discovery/scanning", !(state.status.discovery?.scanning === true), state.status.discovery?.scanning ? "Stopping scan" : (usbMode ? "Starting USB Network scan" : "Starting scan"));
  });
  discoverableBtn?.addEventListener("click", () => {
    const usbMode = normalizeSyncTransport(state.syncSettings.syncTransport) === "usb";
    runToggle("/api/sync/discovery/discoverable", !(state.status.discovery?.discoverable === true), state.status.discovery?.discoverable ? "Disabling discoverability" : (usbMode ? "Enabling USB Network discoverability" : "Enabling discoverability"));
  });
  protectWritesEl?.addEventListener("change", () => toggleProtection(protectWritesEl.checked));
  protectEnableBtn?.addEventListener("click", () => toggleProtection(true));
  protectDisableBtn?.addEventListener("click", () => toggleProtection(false));
  syncDryBtn?.addEventListener("click", () => runSync(true));
  syncApplyBtn?.addEventListener("click", () => runSync(false));
  packageExportBtn?.addEventListener("click", () => exportSyncPackage());
  packageImportBtn?.addEventListener("click", () => packageFileInput?.click());
  packageFileInput?.addEventListener("change", () => importSyncPackageFile(packageFileInput.files?.[0] || null));
  receiverDropPathInput?.addEventListener("change", () => persistReceiverDropPath());
  receiverDropPathInput?.addEventListener("blur", () => persistReceiverDropPath());
  pushPreviewBtn?.addEventListener("click", () => previewMountedPush());
  pushPackageBtn?.addEventListener("click", () => writeMountedPush());
  inboxRefreshBtn?.addEventListener("click", () => refreshInbox());
  inboxListEl?.addEventListener("change", () => { state.selectedInboxPackage = selectedInboxFilename(); });
  inboxPreviewBtn?.addEventListener("click", () => previewInboxSelected());
  inboxImportBtn?.addEventListener("click", () => importInboxSelected());
  jobPauseCardEl?.addEventListener("click", async (event) => {
    const button = event.target?.closest?.("[data-job-retry],[data-job-skip],[data-job-abort]");
    if (!button) return;
    const jobId = String(state.activeJobId || "").trim();
    if (!jobId) return;
    const action = button.hasAttribute("data-job-retry") ? "retry" : button.hasAttribute("data-job-skip") ? "skip" : "abort";
    setBusy(true, action === "retry" ? "Retrying file..." : action === "skip" ? "Skipping file..." : "Aborting sync...");
    try {
      const payload = await apiFetchJson(`/api/sync/jobs/${encodeURIComponent(jobId)}/${action}`, { method: "POST", body: JSON.stringify({}) });
      state.activeJob = payload.job || state.activeJob;
      renderJob();
      setStatus(statusEl, action === "retry" ? "Retrying paused file." : action === "skip" ? "Skipped paused file; sync continuing." : "Sync aborted.");
    } catch (err) {
      setError(errorEl, err?.message || `Failed to ${action} sync job`);
    } finally {
      setBusy(false);
    }
  });
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
  renderSyncEvents();

  try {
    setStatus(statusEl, "Loading sync panel...");
    await Promise.all([loadLocalDevice(), loadProtection(), loadScopes(), loadFolders(), refreshStatus(), refreshInbox()]);
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

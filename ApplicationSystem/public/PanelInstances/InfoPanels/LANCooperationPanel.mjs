// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/LANCooperationPanel.mjs
// User -> LAN Cooperation owner panel and visitor request surface.

import { updateToolbarState } from "/panels/createToolbar.mjs";

const DEVICE_STORAGE_KEY = "nodevision.lanCooperation.deviceId";

const TEMPLATE = `
  <div data-lan-panel-root style="display:flex;flex-direction:column;gap:10px;min-width:0;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div>
        <h3 style="margin:0;font-size:1.1em;">LAN Cooperation</h3>
        <p style="margin:4px 0 0;color:#666;font-size:0.9em;">Expose this Notebook to approved devices on the local network.</p>
      </div>
      <button type="button" data-refresh style="border:1px solid #ccc;border-radius:6px;background:#fff;padding:6px 10px;font-size:0.85em;cursor:pointer;">Refresh</button>
    </div>

    <div data-error style="display:none;padding:8px 10px;border-radius:6px;background:#ffecec;color:#9d1e1e;font-size:0.9em;"></div>
    <div data-status style="min-height:20px;color:#444;font-size:0.9em;"></div>

    <section data-owner-section style="display:none;border:1px solid #ddd;border-radius:8px;padding:10px;background:#fafafa;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">
        <div>
          <div style="font-weight:600;">Server Sharing</div>
          <div style="color:#666;font-size:0.84em;margin-top:3px;">Approved devices can view the Notebook, chat, and edit when granted permission.</div>
        </div>
        <span data-sharing-badge style="white-space:nowrap;border:1px solid #ccc;border-radius:999px;padding:3px 8px;font-size:0.76em;color:#555;background:#f7f7f7;">Loading</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
        <label style="display:flex;gap:7px;align-items:center;font-size:0.88em;color:#333;">
          <input type="checkbox" data-enabled>
          <span>Expose on LAN</span>
        </label>
        <label style="display:flex;gap:7px;align-items:center;font-size:0.88em;color:#333;">
          <input type="checkbox" data-allow-requests>
          <span>Allow access requests</span>
        </label>
        <button type="button" data-save-settings style="border:none;border-radius:6px;background:#0a84ff;color:#fff;padding:8px 12px;cursor:pointer;font-size:0.88em;">Apply</button>
      </div>
      <div style="border-top:1px solid #e5e5e5;margin-top:10px;padding-top:10px;">
        <div style="font-weight:600;font-size:0.9em;margin-bottom:6px;">Default Visitor Permissions</div>
        <div data-default-permissions style="display:flex;flex-wrap:wrap;gap:10px;"></div>
      </div>
      <div data-bind-warning style="display:none;margin-top:10px;padding:8px 10px;border-radius:6px;background:#fff7df;color:#6f4e00;font-size:0.84em;line-height:1.35;"></div>
      <div style="margin-top:10px;">
        <div style="font-weight:600;font-size:0.9em;margin-bottom:6px;">LAN Addresses</div>
        <div data-lan-urls style="display:flex;flex-direction:column;gap:6px;max-height:150px;overflow:auto;"></div>
      </div>
    </section>

    <section data-visitor-section style="display:none;border:1px solid #ddd;border-radius:8px;padding:10px;background:#fafafa;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div>
          <div style="font-weight:600;">This Device</div>
          <div data-current-visitor style="color:#555;font-size:0.86em;margin-top:3px;">Loading...</div>
        </div>
        <span data-current-status style="white-space:nowrap;border:1px solid #ccc;border-radius:999px;padding:3px 8px;font-size:0.76em;color:#555;background:#f7f7f7;">Loading</span>
      </div>
      <form data-request-form style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
        <label style="display:flex;flex-direction:column;font-size:0.86em;gap:4px;flex:1 1 190px;">Display Name
          <input data-request-name name="displayName" type="text" maxlength="80" style="padding:7px;border:1px solid #bbb;border-radius:6px;width:100%;box-sizing:border-box;">
        </label>
        <label style="display:flex;gap:6px;align-items:center;font-size:0.84em;padding-bottom:7px;">
          <input type="checkbox" data-request-edit>
          <span>Request edit access</span>
        </label>
        <button type="submit" style="border:none;border-radius:6px;background:#0a84ff;color:#fff;padding:8px 12px;cursor:pointer;font-size:0.88em;">Request Access</button>
      </form>
    </section>

    <section data-owner-section style="display:none;border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;">
        <div style="font-weight:600;">Incoming Requests</div>
        <span data-request-count style="font-size:0.84em;color:#666;">0 pending</span>
      </div>
      <div data-request-list style="display:flex;flex-direction:column;gap:8px;max-height:230px;overflow:auto;"></div>
    </section>

    <section data-owner-section style="display:none;border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;">
        <div style="font-weight:600;">Visitors And Devices</div>
        <span data-visitor-count style="font-size:0.84em;color:#666;">0 devices</span>
      </div>
      <div data-visitor-list style="display:flex;flex-direction:column;gap:8px;max-height:290px;overflow:auto;"></div>
    </section>
  </div>
`;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getDeviceId() {
  try {
    const existing = window.localStorage?.getItem(DEVICE_STORAGE_KEY);
    if (existing) return existing;
    const generated = window.crypto?.randomUUID?.() || `lan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage?.setItem(DEVICE_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `lan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function baseHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Nodevision-Lan-Device-Id": getDeviceId(),
  };
}

async function apiJson(url, init = {}) {
  const headers = { ...baseHeaders(), ...(init.headers || {}) };
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function setError(el, message = "") {
  if (!el) return;
  const text = String(message || "").trim();
  el.style.display = text ? "block" : "none";
  el.textContent = text;
}

function setStatus(el, message = "") {
  if (el) el.textContent = String(message || "");
}

function statusColors(status) {
  switch (status) {
    case "connected":
      return { bg: "#eefaf1", color: "#236535", border: "#9fd2ad", label: "Connected" };
    case "pending":
      return { bg: "#fff8e8", color: "#755100", border: "#e0bf70", label: "Pending" };
    case "banned":
      return { bg: "#ffecec", color: "#8e2424", border: "#d99", label: "Banned" };
    case "rejected":
      return { bg: "#f3f3f3", color: "#555", border: "#ccc", label: "Rejected" };
    case "new":
      return { bg: "#f7f7f7", color: "#555", border: "#ccc", label: "Not Requested" };
    default:
      return { bg: "#f7f7f7", color: "#555", border: "#ccc", label: status || "Unknown" };
  }
}

function badgeHtml(status) {
  const colors = statusColors(status);
  return `<span style="white-space:nowrap;border:1px solid ${colors.border};border-radius:999px;padding:3px 8px;font-size:0.76em;color:${colors.color};background:${colors.bg};">${colors.label}</span>`;
}

function permissionInputs(permissions = {}, prefix = "permission") {
  const normalized = {
    view: permissions.view !== false,
    edit: permissions.edit === true,
    chat: permissions.chat !== false,
  };
  return `
    <label style="display:flex;gap:5px;align-items:center;font-size:0.82em;color:#333;">
      <input type="checkbox" data-${prefix}="view" ${normalized.view ? "checked" : ""}>
      <span>View</span>
    </label>
    <label style="display:flex;gap:5px;align-items:center;font-size:0.82em;color:#333;">
      <input type="checkbox" data-${prefix}="edit" ${normalized.edit ? "checked" : ""}>
      <span>Edit</span>
    </label>
    <label style="display:flex;gap:5px;align-items:center;font-size:0.82em;color:#333;">
      <input type="checkbox" data-${prefix}="chat" ${normalized.chat ? "checked" : ""}>
      <span>Chat</span>
    </label>
  `;
}

function readPermissionsFrom(container, prefix = "permission") {
  const read = (name) => container?.querySelector(`[data-${prefix}="${name}"]`)?.checked === true;
  return {
    view: read("view"),
    edit: read("edit"),
    chat: read("chat"),
  };
}

function formatTime(value = "") {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderUrlRows(urls = []) {
  if (!urls.length) {
    return `<div style="color:#777;font-size:0.86em;">No LAN addresses detected.</div>`;
  }
  return urls.map((item) => `
    <div style="display:flex;gap:8px;align-items:center;min-width:0;border:1px solid #ececec;border-radius:6px;padding:7px;background:#fff;">
      <div style="flex:1 1 auto;min-width:0;">
        <div style="font-size:0.78em;color:#666;">${escapeHtml(item.label || item.kind || "LAN")}</div>
        <div style="font:12px ui-monospace, SFMono-Regular, Menlo, monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.url)}</div>
      </div>
      <button type="button" data-copy-url="${escapeHtml(item.url)}" title="Copy address" style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:5px 8px;cursor:pointer;font-size:0.8em;">Copy</button>
    </div>
  `).join("");
}

function renderVisitorCard(visitor, { pending = false } = {}) {
  const id = escapeHtml(visitor.deviceId || "");
  const lastSeen = formatTime(visitor.lastSeen);
  const activeLabel = visitor.active ? "active now" : `last seen ${escapeHtml(lastSeen)}`;
  const ua = visitor.userAgent ? `<div style="color:#777;font-size:0.76em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(visitor.userAgent)}</div>` : "";
  const primaryActions = pending
    ? `
      <button type="button" data-action="approve" style="border:none;border-radius:6px;background:#2e8b57;color:#fff;padding:6px 10px;cursor:pointer;font-size:0.82em;">Approve</button>
      <button type="button" data-action="reject" style="border:1px solid #b74d4d;border-radius:6px;background:#fff4f4;color:#8e2424;padding:6px 10px;cursor:pointer;font-size:0.82em;">Reject</button>
    `
    : `
      <button type="button" data-action="save-permissions" style="border:1px solid #777;border-radius:6px;background:#fff;padding:6px 10px;cursor:pointer;font-size:0.82em;">Save Permissions</button>
    `;
  const banAction = visitor.banned
    ? `<button type="button" data-action="unban" style="border:1px solid #777;border-radius:6px;background:#fff;padding:6px 10px;cursor:pointer;font-size:0.82em;">Unban</button>`
    : `<button type="button" data-action="ban" style="border:1px solid #b74d4d;border-radius:6px;background:#fff4f4;color:#8e2424;padding:6px 10px;cursor:pointer;font-size:0.82em;">Ban</button>`;
  const whitelistAction = visitor.whitelisted
    ? `<button type="button" data-action="remove-whitelist" style="border:1px solid #777;border-radius:6px;background:#fff;padding:6px 10px;cursor:pointer;font-size:0.82em;">Remove Whitelist</button>`
    : `<button type="button" data-action="whitelist" style="border:1px solid #6c8fbd;border-radius:6px;background:#f2f7ff;color:#214b7f;padding:6px 10px;cursor:pointer;font-size:0.82em;">Whitelist</button>`;

  return `
    <div data-device-id="${id}" style="border:1px solid #e1e1e1;border-radius:8px;padding:10px;background:#fff;display:flex;flex-direction:column;gap:9px;min-width:0;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div style="min-width:0;">
          <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(visitor.displayName || "LAN Visitor")}</div>
          <div style="color:#666;font-size:0.8em;">${escapeHtml(visitor.ip || "unknown address")} - ${activeLabel}</div>
          ${ua}
        </div>
        ${badgeHtml(visitor.status)}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:9px;align-items:center;">
        ${permissionInputs(visitor.permissions)}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center;">
        ${primaryActions}
        ${whitelistAction}
        ${banAction}
      </div>
    </div>
  `;
}

function renderCurrentVisitor(visitor = {}) {
  const permissions = visitor.permissions || {};
  const granted = [
    permissions.view !== false ? "view" : "",
    permissions.edit === true ? "edit" : "",
    permissions.chat !== false ? "chat" : "",
  ].filter(Boolean);
  const permissionText = granted.length ? granted.join(", ") : "no permissions";
  return `${escapeHtml(visitor.displayName || "This device")} - ${escapeHtml(visitor.ip || "local")} - ${permissionText}`;
}

export async function setupPanel(panelElem, panelVars = {}, panelRoot = null) {
  updateToolbarState({ activePanelType: "LANCooperationPanel" });
  if (typeof panelElem.cleanup === "function") {
    try { panelElem.cleanup(); } catch {}
  }
  const titleEl = panelRoot?.querySelector(".panel-title");
  if (titleEl) titleEl.textContent = panelVars.displayName || "LAN Cooperation";

  panelElem.innerHTML = TEMPLATE;
  const root = panelElem.querySelector("[data-lan-panel-root]");
  const errorEl = panelElem.querySelector("[data-error]");
  const statusEl = panelElem.querySelector("[data-status]");
  const refreshBtn = panelElem.querySelector("[data-refresh]");
  const ownerSections = panelElem.querySelectorAll("[data-owner-section]");
  const visitorSection = panelElem.querySelector("[data-visitor-section]");
  const enabledInput = panelElem.querySelector("[data-enabled]");
  const allowRequestsInput = panelElem.querySelector("[data-allow-requests]");
  const sharingBadge = panelElem.querySelector("[data-sharing-badge]");
  const bindWarning = panelElem.querySelector("[data-bind-warning]");
  const lanUrls = panelElem.querySelector("[data-lan-urls]");
  const defaultPermissionsEl = panelElem.querySelector("[data-default-permissions]");
  const saveSettingsBtn = panelElem.querySelector("[data-save-settings]");
  const requestCount = panelElem.querySelector("[data-request-count]");
  const requestList = panelElem.querySelector("[data-request-list]");
  const visitorCount = panelElem.querySelector("[data-visitor-count]");
  const visitorList = panelElem.querySelector("[data-visitor-list]");
  const currentVisitor = panelElem.querySelector("[data-current-visitor]");
  const currentStatus = panelElem.querySelector("[data-current-status]");
  const requestForm = panelElem.querySelector("[data-request-form]");
  const requestName = panelElem.querySelector("[data-request-name]");
  const requestEdit = panelElem.querySelector("[data-request-edit]");
  let disposed = false;
  let latest = null;
  let refreshTimer = null;

  if (root) {
    root.style.maxHeight = "100%";
    root.style.overflow = "auto";
  }

  function setOwnerVisible(owner) {
    ownerSections.forEach((section) => { section.style.display = owner ? "block" : "none"; });
    if (visitorSection) visitorSection.style.display = owner ? "none" : "block";
  }

  function renderSettings(settings = {}) {
    if (enabledInput) enabledInput.checked = settings.enabled === true;
    if (allowRequestsInput) allowRequestsInput.checked = settings.allowRequests !== false;
    if (defaultPermissionsEl) defaultPermissionsEl.innerHTML = permissionInputs(settings.defaultPermissions || {}, "default-permission");
    if (sharingBadge) {
      const colors = settings.enabled ? statusColors("connected") : statusColors("rejected");
      sharingBadge.textContent = settings.enabled ? "LAN On" : "LAN Off";
      sharingBadge.style.background = colors.bg;
      sharingBadge.style.color = colors.color;
      sharingBadge.style.borderColor = colors.border;
    }
    if (bindWarning) {
      bindWarning.style.display = settings.warning ? "block" : "none";
      bindWarning.textContent = settings.warning || "";
    }
    if (lanUrls) lanUrls.innerHTML = renderUrlRows(settings.urls || []);
  }

  function renderVisitors(visitors = []) {
    const pending = visitors.filter((visitor) => visitor.status === "pending" && visitor.banned !== true);
    const all = visitors.slice().sort((a, b) => {
      const aActive = a.active ? 0 : 1;
      const bActive = b.active ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return String(a.displayName || "").localeCompare(String(b.displayName || ""));
    });

    if (requestCount) requestCount.textContent = `${pending.length} pending`;
    if (visitorCount) visitorCount.textContent = `${all.length} device${all.length === 1 ? "" : "s"}`;
    if (requestList) {
      requestList.innerHTML = pending.length
        ? pending.map((visitor) => renderVisitorCard(visitor, { pending: true })).join("")
        : `<div style="color:#777;font-size:0.86em;">No pending access requests.</div>`;
    }
    if (visitorList) {
      visitorList.innerHTML = all.length
        ? all.map((visitor) => renderVisitorCard(visitor)).join("")
        : `<div style="color:#777;font-size:0.86em;">No visitor devices have been seen yet.</div>`;
    }
  }

  function renderVisitorSelf(payload) {
    const visitor = payload.currentVisitor || {};
    if (currentVisitor) currentVisitor.innerHTML = renderCurrentVisitor(visitor);
    if (currentStatus) {
      const colors = statusColors(visitor.status);
      currentStatus.textContent = colors.label;
      currentStatus.style.background = colors.bg;
      currentStatus.style.color = colors.color;
      currentStatus.style.borderColor = colors.border;
    }
    if (requestName && !requestName.value) {
      requestName.value = visitor.displayName || payload.session?.username || "";
    }
    if (requestForm) {
      requestForm.style.display = payload.settings?.enabled === false ? "none" : "flex";
    }
  }

  function render(payload) {
    latest = payload;
    setOwnerVisible(payload.owner === true);
    renderSettings(payload.settings || {});
    if (payload.owner) {
      renderVisitors(Array.isArray(payload.visitors) ? payload.visitors : []);
    } else {
      renderVisitorSelf(payload);
    }
  }

  async function refresh({ quiet = false } = {}) {
    if (disposed) return;
    if (!quiet) setStatus(statusEl, "Loading LAN cooperation status...");
    try {
      const payload = await apiJson("/api/lan-cooperation/status");
      render(payload);
      setError(errorEl, "");
      if (!quiet) setStatus(statusEl, payload.owner ? "LAN cooperation controls loaded." : "Device status loaded.");
    } catch (err) {
      setError(errorEl, err.message || "Failed to load LAN cooperation status");
      if (!quiet) setStatus(statusEl, "");
    }
  }

  async function saveSettings() {
    const permissions = readPermissionsFrom(defaultPermissionsEl, "default-permission");
    setStatus(statusEl, "Saving LAN sharing settings...");
    try {
      const payload = await apiJson("/api/lan-cooperation/settings", {
        method: "POST",
        body: JSON.stringify({
          enabled: enabledInput?.checked === true,
          allowRequests: allowRequestsInput?.checked !== false,
          defaultPermissions: permissions,
        }),
      });
      render({ ...latest, ...payload, owner: true });
      setError(errorEl, "");
      setStatus(statusEl, "LAN sharing settings saved.");
    } catch (err) {
      setError(errorEl, err.message || "Failed to save settings");
      setStatus(statusEl, "");
    }
  }

  async function handleVisitorAction(button) {
    const card = button.closest("[data-device-id]");
    const deviceId = card?.dataset.deviceId;
    const action = button.dataset.action;
    if (!deviceId || !action) return;
    const permissions = readPermissionsFrom(card);
    let url = "";
    let init = { method: "POST", body: "{}" };

    if (action === "approve" || action === "reject") {
      url = `/api/lan-cooperation/visitors/${encodeURIComponent(deviceId)}/decision`;
      init.body = JSON.stringify({ action, permissions });
    } else if (action === "save-permissions") {
      url = `/api/lan-cooperation/visitors/${encodeURIComponent(deviceId)}/permissions`;
      init = { method: "PATCH", body: JSON.stringify({ permissions }) };
    } else if (action === "whitelist" || action === "remove-whitelist") {
      url = `/api/lan-cooperation/visitors/${encodeURIComponent(deviceId)}/whitelist`;
      init.body = JSON.stringify({ whitelisted: action === "whitelist" });
    } else if (action === "ban" || action === "unban") {
      url = `/api/lan-cooperation/visitors/${encodeURIComponent(deviceId)}/ban`;
      init.body = JSON.stringify({ banned: action === "ban" });
    } else {
      return;
    }

    button.disabled = true;
    setStatus(statusEl, "Updating visitor...");
    try {
      const payload = await apiJson(url, init);
      render({ ...latest, visitors: payload.visitors || latest?.visitors || [], owner: true });
      setError(errorEl, "");
      setStatus(statusEl, "Visitor updated.");
    } catch (err) {
      setError(errorEl, err.message || "Visitor update failed");
      setStatus(statusEl, "");
    } finally {
      button.disabled = false;
    }
  }

  refreshBtn?.addEventListener("click", () => refresh());
  saveSettingsBtn?.addEventListener("click", saveSettings);

  panelElem.addEventListener("click", async (event) => {
    const copyButton = event.target?.closest?.("[data-copy-url]");
    if (copyButton) {
      const url = copyButton.dataset.copyUrl || "";
      try {
        await navigator.clipboard?.writeText(url);
        setStatus(statusEl, "LAN address copied.");
      } catch {
        setStatus(statusEl, url);
      }
      return;
    }

    const visitorButton = event.target?.closest?.("button[data-action]");
    if (visitorButton) {
      await handleVisitorAction(visitorButton);
    }
  });

  requestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(statusEl, "Sending access request...");
    try {
      const payload = await apiJson("/api/lan-cooperation/request-access", {
        method: "POST",
        body: JSON.stringify({
          displayName: requestName?.value || "",
          requestedPermissions: {
            view: true,
            edit: requestEdit?.checked === true,
            chat: true,
          },
        }),
      });
      render({ ...latest, currentVisitor: payload.visitor, settings: payload.settings || latest?.settings || {}, owner: false });
      setError(errorEl, "");
      setStatus(statusEl, "Access request sent.");
    } catch (err) {
      setError(errorEl, err.message || "Failed to request access");
      setStatus(statusEl, "");
    }
  });

  panelElem.cleanup = () => {
    disposed = true;
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = null;
  };

  await refresh();
  refreshTimer = window.setInterval(() => refresh({ quiet: true }), 6000);
}

export default setupPanel;

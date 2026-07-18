// Nodevision/ApplicationSystem/public/LANCooperationChatPanel.mjs
// Persistent far-right LAN cooperation chat panel.

const DEVICE_STORAGE_KEY = "nodevision.lanCooperation.deviceId";
const DISPLAY_NAME_STORAGE_KEY = "nodevision.lanCooperation.displayName";
const CHAT_WIDTH = "320px";
const COLLAPSED_WIDTH = "42px";

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

function getDisplayName(session = null) {
  try {
    const stored = window.localStorage?.getItem(DISPLAY_NAME_STORAGE_KEY);
    if (stored) return stored;
  } catch {}
  return session?.username || "";
}

function persistDisplayName(value = "") {
  try {
    const clean = String(value || "").trim().slice(0, 80);
    if (clean) window.localStorage?.setItem(DISPLAY_NAME_STORAGE_KEY, clean);
  } catch {}
}

function isSameOriginRequest(input) {
  try {
    const url = new URL(typeof input === "string" ? input : input?.url || "", window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function installLanFetchHeader() {
  if (window.__nvLanCooperationFetchWrapped) return;
  const originalFetch = window.fetch?.bind(window);
  if (typeof originalFetch !== "function") return;

  window.fetch = (input, init = {}) => {
    if (!isSameOriginRequest(input)) return originalFetch(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has("X-Nodevision-Lan-Device-Id")) {
      headers.set("X-Nodevision-Lan-Device-Id", getDeviceId());
    }
    return originalFetch(input, {
      ...init,
      credentials: init?.credentials || "include",
      headers,
    });
  };
  window.__nvLanCooperationFetchWrapped = true;
}

async function apiJson(url, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("X-Nodevision-Lan-Device-Id", getDeviceId());
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function injectStyles() {
  if (document.getElementById("nv-lan-chat-style")) return;
  const style = document.createElement("style");
  style.id = "nv-lan-chat-style";
  style.textContent = `
    :root {
      --nv-lan-chat-width: ${CHAT_WIDTH};
      --nv-lan-chat-collapsed-width: ${COLLAPSED_WIDTH};
    }

    body.nv-lan-chat-mounted #workspace {
      right: var(--nv-lan-chat-width);
    }

    body.nv-lan-chat-mounted.nv-lan-chat-collapsed #workspace {
      right: var(--nv-lan-chat-collapsed-width);
    }

    .nv-lan-chat-panel {
      position: fixed;
      top: var(--nv-global-toolbar-height, 40px);
      right: 0;
      bottom: var(--nv-status-bar-height, 22px);
      width: var(--nv-lan-chat-width);
      min-width: 260px;
      margin: 0;
      z-index: 22010;
      display: flex;
      flex-direction: column;
      border-right: 0;
      border-radius: 0;
      box-shadow: -3px 0 12px rgba(0,0,0,0.18);
    }

    .nv-lan-chat-panel .panel-header {
      cursor: default;
      user-select: none;
    }

    .nv-lan-chat-panel .panel-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
      padding: 9px;
      overflow: hidden;
      background: #f7f8fa;
      color: #222;
    }

    .nv-lan-chat-panel[data-collapsed="true"] {
      width: var(--nv-lan-chat-collapsed-width);
      min-width: var(--nv-lan-chat-collapsed-width);
    }

    .nv-lan-chat-panel[data-collapsed="true"] .panel-title,
    .nv-lan-chat-panel[data-collapsed="true"] .panel-content {
      display: none;
    }

    .nv-lan-chat-messages {
      flex: 1 1 auto;
      min-height: 120px;
      overflow-y: auto;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #fff;
      padding: 8px;
    }

    .nv-lan-chat-message {
      padding: 6px 0;
      border-bottom: 1px solid #f0f0f0;
      word-break: break-word;
    }

    .nv-lan-chat-message:last-child {
      border-bottom: 0;
    }

    @media (max-width: 760px) {
      body.nv-lan-chat-mounted #workspace,
      body.nv-lan-chat-mounted.nv-lan-chat-collapsed #workspace {
        right: 0;
      }

      .nv-lan-chat-panel {
        top: auto;
        left: 0;
        width: 100vw;
        min-width: 0;
        height: min(42vh, 360px);
        border-left: 0;
        border-bottom: 0;
      }

      .nv-lan-chat-panel[data-collapsed="true"] {
        left: auto;
        width: var(--nv-lan-chat-collapsed-width);
        height: 40px;
      }
    }
  `;
  document.head.appendChild(style);
}

function formatTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function createPanel() {
  const panel = document.createElement("aside");
  panel.className = "panel nv-lan-chat-panel";
  panel.dataset.collapsed = "false";
  panel.setAttribute("aria-label", "LAN chat");
  panel.innerHTML = `
    <div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
      <span class="panel-title" style="font-size:13px;">LAN Chat</span>
      <button type="button" data-collapse title="Collapse LAN chat" aria-label="Collapse LAN chat" style="border:1px solid #bbb;border-radius:5px;background:#fff;padding:2px 7px;cursor:pointer;">></button>
    </div>
    <div class="panel-content">
      <div data-status style="font-size:0.82em;color:#555;min-height:18px;">Connecting...</div>
      <div data-active-users style="display:flex;flex-wrap:wrap;gap:5px;min-height:22px;"></div>
      <div data-request-box style="display:none;border:1px solid #ddd;border-radius:8px;background:#fff;padding:8px;">
        <div style="font-weight:600;font-size:0.9em;margin-bottom:6px;">Request Access</div>
        <form data-request-form style="display:flex;flex-direction:column;gap:7px;">
          <input data-request-name type="text" maxlength="80" placeholder="Display name" style="padding:7px;border:1px solid #bbb;border-radius:6px;width:100%;box-sizing:border-box;">
          <label style="display:flex;gap:6px;align-items:center;font-size:0.82em;">
            <input data-request-edit type="checkbox">
            <span>Request edit access</span>
          </label>
          <button type="submit" style="border:none;border-radius:6px;background:#0a84ff;color:#fff;padding:8px 10px;cursor:pointer;font-size:0.88em;">Request</button>
        </form>
      </div>
      <div data-messages class="nv-lan-chat-messages"></div>
      <form data-chat-form style="display:flex;gap:6px;align-items:center;">
        <input data-chat-input type="text" maxlength="1600" placeholder="Message" style="flex:1 1 auto;min-width:0;padding:8px;border:1px solid #bbb;border-radius:6px;">
        <button type="submit" title="Send message" style="border:none;border-radius:6px;background:#0a84ff;color:#fff;padding:8px 10px;cursor:pointer;font-size:0.88em;">Send</button>
      </form>
    </div>
  `;
  return panel;
}

function renderActiveUsers(container, users = []) {
  if (!container) return;
  const connected = users.filter((user) => user.status === "connected");
  if (!connected.length) {
    container.innerHTML = `<span style="color:#777;font-size:0.8em;">No other active LAN users.</span>`;
    return;
  }
  container.innerHTML = connected.slice(0, 8).map((user) => `
    <span title="${escapeHtml(user.ip || "")}" style="border:1px solid #cdd7e1;background:#f3f7fb;color:#214b62;border-radius:999px;padding:2px 7px;font-size:0.76em;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
      ${escapeHtml(user.displayName || "User")}
    </span>
  `).join("");
}

function renderMessages(container, messages = [], { append = false } = {}) {
  if (!container) return;
  const wasNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 48;
  const html = messages.map((message) => `
    <div class="nv-lan-chat-message" data-message-id="${Number(message.id) || 0}">
      <div style="display:flex;justify-content:space-between;gap:8px;color:#666;font-size:0.76em;">
        <span style="font-weight:600;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(message.displayName || "User")}</span>
        <span>${escapeHtml(formatTime(message.createdAt))}</span>
      </div>
      <div style="font-size:0.88em;line-height:1.35;margin-top:2px;">${escapeHtml(message.text || "")}</div>
    </div>
  `).join("");
  if (append) {
    if (!container.querySelector("[data-message-id]")) container.innerHTML = "";
    container.insertAdjacentHTML("beforeend", html);
  }
  else container.innerHTML = html || `<div style="color:#777;font-size:0.84em;">No messages yet.</div>`;
  if (wasNearBottom || !append) container.scrollTop = container.scrollHeight;
}

export function initLANCooperationChatPanel() {
  if (window.__nvLanCooperationChatPanelMounted) return window.__nvLanCooperationChatPanelMounted;
  installLanFetchHeader();
  injectStyles();

  const existing = document.querySelector(".nv-lan-chat-panel");
  const panel = existing || createPanel();
  if (!existing) document.body.appendChild(panel);
  document.body.classList.add("nv-lan-chat-mounted");
  document.body.classList.remove("nv-lan-chat-collapsed");

  const statusEl = panel.querySelector("[data-status]");
  const activeUsersEl = panel.querySelector("[data-active-users]");
  const messagesEl = panel.querySelector("[data-messages]");
  const requestBox = panel.querySelector("[data-request-box]");
  const requestForm = panel.querySelector("[data-request-form]");
  const requestName = panel.querySelector("[data-request-name]");
  const requestEdit = panel.querySelector("[data-request-edit]");
  const chatForm = panel.querySelector("[data-chat-form]");
  const chatInput = panel.querySelector("[data-chat-input]");
  const collapseBtn = panel.querySelector("[data-collapse]");

  const state = {
    disposed: false,
    statusTimer: null,
    chatTimer: null,
    latestStatus: null,
    lastMessageId: 0,
    canChat: false,
  };

  function setStatus(message = "") {
    if (statusEl) statusEl.textContent = message;
  }

  function setChatEnabled(enabled) {
    state.canChat = enabled;
    if (chatForm) chatForm.style.display = enabled ? "flex" : "none";
    if (chatInput) chatInput.disabled = !enabled;
  }

  function renderStatus(payload) {
    state.latestStatus = payload;
    const visitor = payload.currentVisitor || {};
    const permissions = visitor.permissions || {};
    const owner = payload.owner === true;
    const enabled = payload.settings?.enabled === true;
    const connected = owner || visitor.status === "connected";
    const canChat = owner || (connected && permissions.chat !== false);
    setChatEnabled(canChat);
    renderActiveUsers(activeUsersEl, payload.activeUsers || []);

    if (requestName && !requestName.value) {
      requestName.value = getDisplayName(payload.session) || visitor.displayName || "";
    }

    if (requestBox) {
      requestBox.style.display = (!owner && enabled && !connected && visitor.status !== "banned") ? "block" : "none";
    }

    if (!enabled && owner) {
      setStatus("LAN sharing is off. User -> LAN Cooperation controls access.");
    } else if (!enabled) {
      setStatus("LAN sharing is off on this server.");
    } else if (owner) {
      setStatus("Owner chat ready.");
    } else if (visitor.status === "connected") {
      setStatus(canChat ? "Connected to LAN chat." : "Connected without chat permission.");
    } else if (visitor.status === "pending") {
      setStatus("Access request pending approval.");
    } else if (visitor.status === "banned") {
      setStatus("This device is banned.");
    } else {
      setStatus("Request access to join this Notebook.");
    }
  }

  async function refreshStatus() {
    try {
      const payload = await apiJson("/api/lan-cooperation/status");
      renderStatus(payload);
    } catch (err) {
      setChatEnabled(false);
      setStatus(err.message || "LAN chat unavailable.");
    }
  }

  async function pollChat() {
    if (!state.canChat) return;
    try {
      const payload = await apiJson(`/api/lan-cooperation/chat?since=${encodeURIComponent(state.lastMessageId)}`);
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      if (messages.length) {
        state.lastMessageId = messages.reduce((max, message) => Math.max(max, Number(message.id) || 0), state.lastMessageId);
        renderMessages(messagesEl, messages, { append: true });
      } else if (!messagesEl?.querySelector?.("[data-message-id]")) {
        renderMessages(messagesEl, []);
      }
      renderActiveUsers(activeUsersEl, payload.activeUsers || []);
    } catch (err) {
      setChatEnabled(false);
      setStatus(err.message || "LAN chat unavailable.");
    }
  }

  async function sendMessage(text) {
    const clean = String(text || "").trim();
    if (!clean) return;
    try {
      const payload = await apiJson("/api/lan-cooperation/chat", {
        method: "POST",
        body: JSON.stringify({ text: clean, displayName: getDisplayName(state.latestStatus?.session) }),
      });
      const messages = Array.isArray(payload.messages) ? payload.messages : (payload.message ? [payload.message] : []);
      if (messages.length) {
        state.lastMessageId = messages.reduce((max, message) => Math.max(max, Number(message.id) || 0), state.lastMessageId);
        renderMessages(messagesEl, messages, { append: true });
      }
      renderActiveUsers(activeUsersEl, payload.activeUsers || []);
    } catch (err) {
      setStatus(err.message || "Message failed.");
    }
  }

  chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = chatInput?.value || "";
    if (chatInput) chatInput.value = "";
    await sendMessage(value);
  });

  requestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const displayName = requestName?.value || "";
    persistDisplayName(displayName);
    try {
      const payload = await apiJson("/api/lan-cooperation/request-access", {
        method: "POST",
        body: JSON.stringify({
          displayName,
          requestedPermissions: {
            view: true,
            edit: requestEdit?.checked === true,
            chat: true,
          },
        }),
      });
      renderStatus({
        ...state.latestStatus,
        currentVisitor: payload.visitor,
        settings: payload.settings || state.latestStatus?.settings || {},
        owner: false,
      });
    } catch (err) {
      setStatus(err.message || "Access request failed.");
    }
  });

  collapseBtn?.addEventListener("click", () => {
    const collapsed = panel.dataset.collapsed !== "true";
    panel.dataset.collapsed = collapsed ? "true" : "false";
    collapseBtn.textContent = collapsed ? "<" : ">";
    collapseBtn.title = collapsed ? "Expand LAN chat" : "Collapse LAN chat";
    collapseBtn.setAttribute("aria-label", collapseBtn.title);
    document.body.classList.toggle("nv-lan-chat-collapsed", collapsed);
  });

  renderMessages(messagesEl, []);
  refreshStatus().then(() => pollChat()).catch(() => {});
  state.statusTimer = window.setInterval(refreshStatus, 5000);
  state.chatTimer = window.setInterval(pollChat, 1800);

  window.__nvLanCooperationChatPanelMounted = {
    panel,
    refresh: refreshStatus,
    dispose() {
      state.disposed = true;
      if (state.statusTimer) window.clearInterval(state.statusTimer);
      if (state.chatTimer) window.clearInterval(state.chatTimer);
      panel.remove();
      document.body.classList.remove("nv-lan-chat-mounted", "nv-lan-chat-collapsed");
      window.__nvLanCooperationChatPanelMounted = null;
    },
  };
  return window.__nvLanCooperationChatPanelMounted;
}

export default initLANCooperationChatPanel;

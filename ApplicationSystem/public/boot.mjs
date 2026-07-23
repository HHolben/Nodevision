// Nodevision/ApplicationSystem/public/boot.mjs
// This file defines browser-side boot logic for the Nodevision UI. It renders interface components and handles user interactions.
const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginButton = loginForm?.querySelector('button[type="submit"]');
const loginPanorama = document.getElementById('login-panorama');

let appStarted = false;
let loginPanoramaChecked = false;

const APP_TIMEOUT_DEFAULT_SECONDS = 60 * 60;
const APP_TIMEOUT_USER_EVENTS = Object.freeze([
  "pointerdown",
  "pointermove",
  "keydown",
  "input",
  "change",
  "wheel",
  "touchstart",
  "paste",
  "drop",
  "compositionend",
]);
const APP_TIMEOUT_MAX_TIMER_MS = 2_147_000_000;
const appTimeoutState = {
  started: false,
  listenersInstalled: false,
  timeoutSeconds: APP_TIMEOUT_DEFAULT_SECONDS,
  minTimeoutSeconds: 60,
  maxTimeoutSeconds: 7 * 24 * 60 * 60,
  expiresAtMs: 0,
  lastInputAt: 0,
  lastActivitySyncedAt: 0,
  timeoutTimer: null,
  activityTimer: null,
  activityInFlight: false,
  pendingActivitySync: false,
};

function normalizeAppTimeoutSeconds(value, fallback = appTimeoutState.timeoutSeconds || APP_TIMEOUT_DEFAULT_SECONDS) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.min(
    appTimeoutState.maxTimeoutSeconds,
    Math.max(appTimeoutState.minTimeoutSeconds, Math.round(seconds))
  );
}

function secondsToMinutes(seconds) {
  return Math.max(1, Math.round(Number(seconds || 0) / 60));
}

function clearAppTimeoutTimer() {
  if (appTimeoutState.timeoutTimer) {
    window.clearTimeout(appTimeoutState.timeoutTimer);
    appTimeoutState.timeoutTimer = null;
  }
}

function clearActivitySyncTimer() {
  if (appTimeoutState.activityTimer) {
    window.clearTimeout(appTimeoutState.activityTimer);
    appTimeoutState.activityTimer = null;
  }
}

async function logoutForAppTimeout() {
  stopAppTimeoutManager();
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch (err) {
    console.warn("App timeout logout request failed", err);
  }
  window.location.href = "/";
}

function scheduleAppTimeout(deadlineMs = appTimeoutState.expiresAtMs) {
  clearAppTimeoutTimer();
  if (!appTimeoutState.started || !deadlineMs) return;

  const delay = Math.max(0, Number(deadlineMs) - Date.now());
  if (delay <= 0) {
    appTimeoutState.timeoutTimer = window.setTimeout(logoutForAppTimeout, 0);
    return;
  }

  appTimeoutState.timeoutTimer = window.setTimeout(
    () => scheduleAppTimeout(deadlineMs),
    Math.min(delay, APP_TIMEOUT_MAX_TIMER_MS)
  );
}

function applyAppTimeoutPayload(payload = {}) {
  if (!payload || typeof payload !== "object") return;
  if (payload.minTimeoutSeconds) appTimeoutState.minTimeoutSeconds = Math.max(1, Number(payload.minTimeoutSeconds) || 60);
  if (payload.maxTimeoutSeconds) appTimeoutState.maxTimeoutSeconds = Math.max(appTimeoutState.minTimeoutSeconds, Number(payload.maxTimeoutSeconds) || appTimeoutState.maxTimeoutSeconds);
  if (payload.timeoutSeconds) appTimeoutState.timeoutSeconds = normalizeAppTimeoutSeconds(payload.timeoutSeconds);
  if (payload.expires) {
    appTimeoutState.expiresAtMs = Number(payload.expires) * 1000;
    scheduleAppTimeout(appTimeoutState.expiresAtMs);
  } else if (appTimeoutState.lastInputAt) {
    appTimeoutState.expiresAtMs = appTimeoutState.lastInputAt + appTimeoutState.timeoutSeconds * 1000;
    scheduleAppTimeout(appTimeoutState.expiresAtMs);
  }
}

async function fetchAppTimeoutSettings() {
  const response = await fetch("/api/session/timeout", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Unable to read timeout settings");
  const payload = await response.json();
  applyAppTimeoutPayload(payload);
  return payload;
}

async function saveAppTimeoutSettings(timeoutSeconds) {
  const response = await fetch("/api/session/timeout", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ timeoutSeconds }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Unable to save timeout settings");
  appTimeoutState.lastInputAt = Date.now();
  applyAppTimeoutPayload(payload);
  return payload;
}

function activitySyncIntervalMs() {
  return Math.min(30_000, Math.max(5_000, Math.floor(appTimeoutState.timeoutSeconds * 250)));
}

async function flushAppUserActivity() {
  clearActivitySyncTimer();
  if (!appTimeoutState.started) return;
  if (appTimeoutState.activityInFlight) {
    appTimeoutState.pendingActivitySync = true;
    return;
  }

  appTimeoutState.activityInFlight = true;
  appTimeoutState.pendingActivitySync = false;
  try {
    const response = await fetch("/api/session/activity", {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      await logoutForAppTimeout();
      return;
    }
    if (!response.ok) throw new Error(payload?.error || "Unable to refresh session activity");
    appTimeoutState.lastActivitySyncedAt = Date.now();
    applyAppTimeoutPayload(payload);
  } catch (err) {
    console.warn("Session activity refresh failed", err);
  } finally {
    appTimeoutState.activityInFlight = false;
    if (appTimeoutState.pendingActivitySync) queueAppUserActivitySync();
  }
}

function queueAppUserActivitySync() {
  if (!appTimeoutState.started) return;
  const elapsed = Date.now() - appTimeoutState.lastActivitySyncedAt;
  const delay = appTimeoutState.lastActivitySyncedAt && elapsed < activitySyncIntervalMs()
    ? activitySyncIntervalMs() - elapsed
    : 0;
  clearActivitySyncTimer();
  appTimeoutState.activityTimer = window.setTimeout(flushAppUserActivity, delay);
}

function recordAppUserActivity(event = null) {
  if (event?.isTrusted === false) return;
  if (!appTimeoutState.started || appShell?.classList.contains("hidden")) return;
  const now = Date.now();
  appTimeoutState.lastInputAt = now;
  appTimeoutState.expiresAtMs = now + appTimeoutState.timeoutSeconds * 1000;
  scheduleAppTimeout(appTimeoutState.expiresAtMs);
  queueAppUserActivitySync();
}

function installAppTimeoutListeners() {
  if (appTimeoutState.listenersInstalled) return;
  for (const eventName of APP_TIMEOUT_USER_EVENTS) {
    document.addEventListener(eventName, recordAppUserActivity, { capture: true, passive: true });
  }
  appTimeoutState.listenersInstalled = true;
}

function startAppTimeoutManager(session = {}) {
  appTimeoutState.started = true;
  installAppTimeoutListeners();
  applyAppTimeoutPayload(session);
  fetchAppTimeoutSettings().catch((err) => {
    console.warn("Unable to load app timeout settings", err);
  });
}

function stopAppTimeoutManager() {
  appTimeoutState.started = false;
  clearAppTimeoutTimer();
  clearActivitySyncTimer();
  appTimeoutState.activityInFlight = false;
  appTimeoutState.pendingActivitySync = false;
}

function ensureAppTimeoutOverlayStyles() {
  if (document.getElementById("nv-app-timeout-settings-style")) return;
  const style = document.createElement("style");
  style.id = "nv-app-timeout-settings-style";
  style.textContent = `
    .nv-app-timeout-overlay {
      position: fixed;
      inset: 0;
      z-index: 30000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.42);
      font: 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .nv-app-timeout-dialog {
      width: min(420px, calc(100vw - 32px));
      border: 1px solid #aeb8c5;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 18px 44px rgba(15, 23, 42, 0.28);
      color: #172033;
    }
    .nv-app-timeout-dialog header,
    .nv-app-timeout-dialog footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-bottom: 1px solid #d7dde7;
    }
    .nv-app-timeout-dialog footer {
      justify-content: flex-end;
      border-top: 1px solid #d7dde7;
      border-bottom: 0;
    }
    .nv-app-timeout-dialog h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 650;
    }
    .nv-app-timeout-body {
      display: grid;
      gap: 12px;
      padding: 14px;
    }
    .nv-app-timeout-field {
      display: grid;
      grid-template-columns: 72px 1fr 82px;
      align-items: center;
      gap: 10px;
    }
    .nv-app-timeout-field input[type="range"] {
      width: 100%;
    }
    .nv-app-timeout-field input[type="number"] {
      width: 82px;
      box-sizing: border-box;
      padding: 5px 6px;
      border: 1px solid #aeb8c5;
      border-radius: 4px;
      font: inherit;
    }
    .nv-app-timeout-status {
      min-height: 18px;
      color: #4b5563;
    }
    .nv-app-timeout-button {
      border: 1px solid #9ca7b6;
      border-radius: 5px;
      background: #f8fafc;
      color: #172033;
      cursor: pointer;
      font: inherit;
      padding: 6px 10px;
    }
    .nv-app-timeout-button[data-primary] {
      border-color: #2563eb;
      background: #2563eb;
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}

async function openAppTimeoutSettings() {
  ensureAppTimeoutOverlayStyles();
  document.querySelector(".nv-app-timeout-overlay")?.remove();

  let settings = {
    timeoutSeconds: appTimeoutState.timeoutSeconds,
    minTimeoutSeconds: appTimeoutState.minTimeoutSeconds,
    maxTimeoutSeconds: appTimeoutState.maxTimeoutSeconds,
  };
  try {
    settings = { ...settings, ...(await fetchAppTimeoutSettings()) };
  } catch (err) {
    console.warn("Unable to refresh timeout settings before opening dialog", err);
  }

  const minMinutes = secondsToMinutes(settings.minTimeoutSeconds);
  const maxMinutes = secondsToMinutes(settings.maxTimeoutSeconds);
  const currentMinutes = secondsToMinutes(settings.timeoutSeconds);
  const overlay = document.createElement("div");
  overlay.className = "nv-app-timeout-overlay";
  overlay.innerHTML = `
    <section class="nv-app-timeout-dialog" role="dialog" aria-modal="true" aria-labelledby="nv-app-timeout-title">
      <header><h2 id="nv-app-timeout-title">App Timeout</h2></header>
      <div class="nv-app-timeout-body">
        <label class="nv-app-timeout-field">Minutes
          <input data-timeout-range type="range" min="${minMinutes}" max="${maxMinutes}" step="1" value="${currentMinutes}">
          <input data-timeout-minutes type="number" min="${minMinutes}" max="${maxMinutes}" step="1" value="${currentMinutes}">
        </label>
        <div class="nv-app-timeout-status" data-timeout-status></div>
      </div>
      <footer>
        <button class="nv-app-timeout-button" type="button" data-timeout-cancel>Cancel</button>
        <button class="nv-app-timeout-button" type="button" data-timeout-default>Default</button>
        <button class="nv-app-timeout-button" type="button" data-primary data-timeout-save>Save</button>
      </footer>
    </section>
  `;
  document.body.appendChild(overlay);

  const range = overlay.querySelector("[data-timeout-range]");
  const minutes = overlay.querySelector("[data-timeout-minutes]");
  const status = overlay.querySelector("[data-timeout-status]");
  const clampMinutes = (value) => Math.min(maxMinutes, Math.max(minMinutes, Math.round(Number(value) || currentMinutes)));
  const setValue = (value) => {
    const next = clampMinutes(value);
    range.value = String(next);
    minutes.value = String(next);
    status.textContent = "";
    status.style.color = "#4b5563";
    return next;
  };

  range.addEventListener("input", () => setValue(range.value));
  minutes.addEventListener("input", () => setValue(minutes.value));
  overlay.querySelector("[data-timeout-cancel]")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  overlay.querySelector("[data-timeout-default]")?.addEventListener("click", () => {
    setValue(secondsToMinutes(settings.defaultTimeoutSeconds || APP_TIMEOUT_DEFAULT_SECONDS));
  });
  overlay.querySelector("[data-timeout-save]")?.addEventListener("click", async () => {
    const saveButton = overlay.querySelector("[data-timeout-save]");
    const nextMinutes = setValue(minutes.value);
    saveButton.disabled = true;
    status.style.color = "#4b5563";
    status.textContent = "Saving...";
    try {
      await saveAppTimeoutSettings(nextMinutes * 60);
      status.textContent = "Saved.";
      window.setTimeout(() => overlay.remove(), 350);
    } catch (err) {
      status.textContent = err?.message || "Unable to save.";
      status.style.color = "#b00020";
    } finally {
      saveButton.disabled = false;
    }
  });
  minutes.focus();
  minutes.select?.();
}

window.NodevisionAppTimeout = {
  openSettings: openAppTimeoutSettings,
  refreshSettings: fetchAppTimeoutSettings,
  recordUserInput: recordAppUserActivity,
  getState: () => ({
    timeoutSeconds: appTimeoutState.timeoutSeconds,
    expiresAtMs: appTimeoutState.expiresAtMs,
    lastInputAt: appTimeoutState.lastInputAt,
  }),
};


function applyStoredTheme() {
  try {
    const stored = localStorage.getItem('nodevision_theme');
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.dataset.nvTheme = stored;
      document.documentElement.style.colorScheme = stored;
    }
  } catch {
    // ignore
  }
}

function setUiState({ showAppView = false } = {}) {
  if (showAppView) {
    loginScreen?.classList.add('hidden');
    appShell?.classList.remove('hidden');
  } else {
    stopAppTimeoutManager();
    loginScreen?.classList.remove('hidden');
    appShell?.classList.add('hidden');
    ensureLoginPanorama();
  }
}

async function ensureLoginPanorama() {
  if (loginPanoramaChecked) return;
  loginPanoramaChecked = true;
  if (!loginPanorama) return;

  const baseUrl = '/ServerData/NotebookLoginBackground.svg';
  try {
    const res = await fetch(baseUrl, { method: 'HEAD', cache: 'no-store' });
    if (!res.ok) {
      loginPanorama.style.display = 'none';
      return;
    }

    // Cache-bust to avoid stale asset when the SVG is edited.
    const stamped = `${baseUrl}?t=${Date.now()}`;
    document.documentElement?.style?.setProperty('--nv-login-panorama-image', `url('${stamped}')`);
  } catch (err) {
    console.debug('Login panorama preflight failed:', err);
    loginPanorama.style.display = 'none';
  }
}

async function fetchSession() {
  try {
    const response = await fetch('/api/session', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      console.debug('Session endpoint responded with', response.status);
      return null;
    }

    const payload = await response.json();
    return payload.loggedIn ? payload : null;
  } catch (err) {
    console.error('Failed to read session', err);
    return null;
  }
}

async function startApp() {
  if (appStarted) {
    return;
  }
  appStarted = true;
  try {
    await import('./main.mjs');
  } catch (err) {
    console.error('Unable to start Nodevision', err);
    loginError.textContent = 'Failed to start the workspace.';
    appStarted = false;
  }
}

function updateLoginError(message) {
  if (loginError) {
    loginError.textContent = message;
  }
}

async function attemptLogin(credentials) {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (response.ok) {
    return response.json();
  }

  const payload = await response
    .json()
    .catch(() => ({ error: 'Unable to authenticate' }));
  throw new Error(payload?.error ?? 'Unable to authenticate');
}

async function handleLogin(event) {
  event.preventDefault();
  updateLoginError('');

  const formData = new FormData(loginForm);
  const username = formData.get('username')?.toString().trim() ?? '';
  const password = formData.get('password')?.toString() ?? '';

  if (!username || !password) {
    updateLoginError('Both username and password are required.');
    return;
  }

  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in…';
  }

  try {
    const session = await attemptLogin({ username, password });
    setUiState({ showAppView: true });
    startAppTimeoutManager(session);
    recordAppUserActivity();
    await startApp();
  } catch (err) {
    updateLoginError(err?.message ?? 'Login failed.');
    setUiState({ showAppView: false });
  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = 'Log in';
    }
  }
}

async function init() {
  applyStoredTheme();
  loginForm?.addEventListener('submit', handleLogin);
  ensureLoginPanorama();

  try {
    const session = await fetchSession();
    if (session) {
      setUiState({ showAppView: true });
      startAppTimeoutManager(session);
      await startApp();
    } else {
      setUiState({ showAppView: false });
    }
  } finally {
    document.body?.classList.remove('booting');
  }
}

init();

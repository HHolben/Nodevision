// Nodevision/ApplicationSystem/public/Settings/SpeechRecognitionSettingsOverlay.mjs
// This module opens the Dictation Settings overlay and persists local speech-recognition provider settings.

const OVERLAY_ID = "nv-speech-recognition-settings-overlay";
const STYLE_ID = "nv-speech-recognition-settings-style";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-recognition-settings { position: fixed; inset: 0; z-index: 36000; display: flex; align-items: center; justify-content: center; background: rgba(10, 12, 18, 0.58); padding: 18px; box-sizing: border-box; }
.nv-recognition-settings * { box-sizing: border-box; }
.nv-recognition-settings__panel { width: min(680px, 100%); max-height: min(88vh, 860px); overflow: auto; background: #fff; color: #1f2329; border: 1px solid #ccd5df; border-radius: 10px; box-shadow: 0 24px 56px rgba(7, 12, 20, 0.32); padding: 18px; font-family: var(--nv-ui-font-family, Arial, sans-serif); }
.nv-recognition-settings__title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.nv-recognition-settings__title { margin: 0; font-size: 1.15rem; }
.nv-recognition-settings__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.nv-recognition-settings__field { display: flex; flex-direction: column; gap: 4px; font-size: 0.9rem; }
.nv-recognition-settings__field input, .nv-recognition-settings__field select { width: 100%; min-height: 34px; padding: 7px 8px; border: 1px solid #b8c4d1; border-radius: 6px; font-size: 0.9rem; }
.nv-recognition-settings__toggle { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 0.9rem; }
.nv-recognition-settings__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.nv-recognition-settings button { border: 1px solid #9badbe; border-radius: 6px; padding: 8px 12px; background: #f6f8fb; color: #1e2a36; font-size: 0.88rem; cursor: pointer; }
.nv-recognition-settings button:hover:not(:disabled) { background: #e7eef6; }
.nv-recognition-settings__status { margin-top: 10px; min-height: 22px; font-size: 0.88rem; color: #2e4b68; word-break: break-word; }
.nv-recognition-settings__status[data-kind="error"] { color: #b02a37; }
.nv-recognition-settings__status[data-kind="success"] { color: #176f2d; }
`;
  document.head.appendChild(style);
}

function createOverlay() {
  const wrapper = document.createElement("div");
  wrapper.id = OVERLAY_ID;
  wrapper.className = "nv-recognition-settings";
  wrapper.innerHTML = `
    <section class="nv-recognition-settings__panel" role="dialog" aria-modal="true" aria-labelledby="nv-recognition-settings-title">
      <div class="nv-recognition-settings__title-row">
        <h2 id="nv-recognition-settings-title" class="nv-recognition-settings__title">Dictation Settings</h2>
        <button type="button" data-action="close">Close</button>
      </div>
      <div class="nv-recognition-settings__grid">
        <label class="nv-recognition-settings__field"><span>Provider</span><select name="providerId"><option value="whisper-cpp">whisper.cpp</option><option value="automatic">Automatic Offline</option><option value="browser-recognition">Browser SpeechRecognition</option></select></label>
        <label class="nv-recognition-settings__field"><span>Language</span><input name="language" autocomplete="off" placeholder="en" /></label>
        <label class="nv-recognition-settings__field"><span>Threads</span><input name="threads" type="number" min="1" max="32" step="1" /></label>
        <label class="nv-recognition-settings__field"><span>Timeout (ms)</span><input name="timeoutMs" type="number" min="5000" max="600000" step="1000" /></label>
        <label class="nv-recognition-settings__field"><span>whisper.cpp Executable</span><input name="whisperExecutable" autocomplete="off" placeholder="whisper-cli" /></label>
        <label class="nv-recognition-settings__field"><span>Whisper Model Path</span><input name="whisperModelPath" autocomplete="off" /></label>
      </div>
      <label class="nv-recognition-settings__toggle"><input type="checkbox" name="allowBrowserRecognition" /> Allow browser recognition provider</label>
      <div class="nv-recognition-settings__actions">
        <button type="button" data-action="refresh">Refresh</button>
        <button type="button" data-action="save">Save</button>
        <button type="button" data-action="close">Close</button>
      </div>
      <div class="nv-recognition-settings__status" data-status></div>
    </section>
  `;
  return wrapper;
}

function setStatus(root, message, kind = "info") {
  const el = root.querySelector("[data-status]");
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind;
}

async function apiJson(url, body = null) {
  const options = body ? {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body),
  } : { credentials: "same-origin", headers: { "Accept": "application/json" }, cache: "no-store" };
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `Request failed with ${response.status}.`);
  return payload;
}

function readSettings(root) {
  const providerId = root.querySelector('[name="providerId"]')?.value || "whisper-cpp";
  return {
    providerId,
    language: root.querySelector('[name="language"]')?.value || "en",
    threads: Number(root.querySelector('[name="threads"]')?.value || 4),
    timeoutMs: Number(root.querySelector('[name="timeoutMs"]')?.value || 120000),
    whisperExecutable: root.querySelector('[name="whisperExecutable"]')?.value || "",
    whisperModelPath: root.querySelector('[name="whisperModelPath"]')?.value || "",
    allowBrowserRecognition: providerId === "browser-recognition" || Boolean(root.querySelector('[name="allowBrowserRecognition"]')?.checked),
  };
}

function writeSettings(root, settings = {}, defaults = {}) {
  root.querySelector('[name="providerId"]').value = settings.providerId || "whisper-cpp";
  root.querySelector('[name="language"]').value = settings.language || "en";
  root.querySelector('[name="threads"]').value = String(settings.threads || 4);
  root.querySelector('[name="timeoutMs"]').value = String(settings.timeoutMs || 120000);
  root.querySelector('[name="whisperExecutable"]').value = settings.whisperExecutable || "";
  root.querySelector('[name="whisperModelPath"]').value = settings.whisperModelPath || "";
  root.querySelector('[name="whisperModelPath"]').placeholder = defaults.whisperModelPath || "";
  root.querySelector('[name="allowBrowserRecognition"]').checked = settings.allowBrowserRecognition === true;
}

function rememberClientSettings(settings) {
  try {
    window.localStorage?.setItem("nodevision.speechRecognition.provider", settings.providerId || "whisper-cpp");
    window.localStorage?.setItem("nodevision.speechRecognition.allowBrowser", settings.allowBrowserRecognition ? "true" : "false");
  } catch {
    // Local storage is optional.
  }
}

async function refreshProviderStatus(root) {
  const payload = await apiJson("/api/speech/recognition/providers");
  const lines = (payload.providers || []).map((provider) => `${provider.label || provider.id}: ${provider.available ? "available" : provider.reason || "unavailable"}`);
  setStatus(root, lines.join(" | ") || "No recognition providers reported.", lines.some((line) => /unavailable|not available/i.test(line)) ? "error" : "success");
}

export async function openSpeechRecognitionSettingsOverlay() {
  ensureStyles();
  document.getElementById(OVERLAY_ID)?.remove();
  const overlay = createOverlay();
  document.body.appendChild(overlay);

  const closeOverlay = () => {
    document.removeEventListener("keydown", handleEscape);
    overlay.remove();
  };
  const handleEscape = (event) => {
    if (event.key === "Escape") closeOverlay();
  };
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeOverlay(); });
  overlay.querySelectorAll('[data-action="close"]').forEach((button) => button.addEventListener("click", closeOverlay));
  overlay.querySelector('[data-action="refresh"]')?.addEventListener("click", () => refreshProviderStatus(overlay).catch((err) => setStatus(overlay, err.message, "error")));
  overlay.querySelector('[data-action="save"]')?.addEventListener("click", async () => {
    try {
      const payload = await apiJson("/api/speech/recognition/settings", readSettings(overlay));
      writeSettings(overlay, payload.settings, payload.defaults);
      rememberClientSettings(payload.settings);
      setStatus(overlay, "Dictation settings saved.", "success");
    } catch (err) {
      setStatus(overlay, err?.message || "Unable to save dictation settings.", "error");
    }
  });
  document.addEventListener("keydown", handleEscape);

  try {
    const payload = await apiJson("/api/speech/recognition/settings");
    writeSettings(overlay, payload.settings, payload.defaults);
    rememberClientSettings(payload.settings);
    await refreshProviderStatus(overlay);
  } catch (err) {
    setStatus(overlay, err?.message || "Unable to load dictation settings.", "error");
  }
}

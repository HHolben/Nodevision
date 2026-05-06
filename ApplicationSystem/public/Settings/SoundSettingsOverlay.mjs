// Nodevision/ApplicationSystem/public/Settings/SoundSettingsOverlay.mjs
// This file defines the sound settings overlay for optional focus background audio, including API load/save behavior and playback controls.

import {
  startBinauralFocus,
  stopBinauralFocus,
  setBinauralVolume,
  isBinauralFocusPlaying,
  applyBinauralSettings,
} from "../Audio/BinauralFocusPlayer.mjs";
import { DEFAULT_SOUND_SETTINGS, sanitizeSoundSettings } from "./soundSettingsModel.mjs";

const OVERLAY_ID = "nv-sound-settings-overlay";
const STYLE_ID = "nv-sound-settings-overlay-style";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-sound-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 36000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 12, 18, 0.58);
  padding: 18px;
  box-sizing: border-box;
}

.nv-sound-settings-overlay * {
  box-sizing: border-box;
}

.nv-sound-settings-overlay__panel {
  width: min(620px, 100%);
  max-height: min(88vh, 860px);
  overflow: auto;
  background: #ffffff;
  color: #1f2329;
  border: 1px solid #ccd5df;
  border-radius: 10px;
  box-shadow: 0 24px 56px rgba(7, 12, 20, 0.32);
  padding: 18px;
  font-family: "Segoe UI", Tahoma, sans-serif;
}

.nv-sound-settings-overlay__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.nv-sound-settings-overlay__title {
  margin: 0;
  font-size: 1.15rem;
}

.nv-sound-settings-overlay__text {
  margin: 0 0 14px;
  font-size: 0.92rem;
  color: #425160;
}

.nv-sound-settings-overlay__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.nv-sound-settings-overlay__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9rem;
}

.nv-sound-settings-overlay__field input[type="number"] {
  width: 100%;
  padding: 7px 8px;
  border: 1px solid #b8c4d1;
  border-radius: 6px;
  font-size: 0.9rem;
}

.nv-sound-settings-overlay__volume {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nv-sound-settings-overlay__volume input[type="range"] {
  flex: 1;
}

.nv-sound-settings-overlay__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  font-size: 0.92rem;
}

.nv-sound-settings-overlay__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.nv-sound-settings-overlay button {
  border: 1px solid #9badbe;
  border-radius: 6px;
  padding: 8px 12px;
  background: #f6f8fb;
  color: #1e2a36;
  font-size: 0.88rem;
  cursor: pointer;
}

.nv-sound-settings-overlay button:hover:not(:disabled) {
  background: #e7eef6;
}

.nv-sound-settings-overlay button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nv-sound-settings-overlay__status {
  margin-top: 10px;
  min-height: 22px;
  font-size: 0.88rem;
  color: #2e4b68;
}

.nv-sound-settings-overlay__status[data-kind="error"] {
  color: #b02a37;
}

.nv-sound-settings-overlay__status[data-kind="success"] {
  color: #176f2d;
}
`;

  document.head.appendChild(style);
}

function createOverlayMarkup() {
  const wrapper = document.createElement("div");
  wrapper.id = OVERLAY_ID;
  wrapper.className = "nv-sound-settings-overlay";
  wrapper.tabIndex = -1;
  wrapper.setAttribute("role", "presentation");

  wrapper.innerHTML = `
    <section class="nv-sound-settings-overlay__panel" role="dialog" aria-modal="true" aria-labelledby="nv-sound-settings-title">
      <div class="nv-sound-settings-overlay__title-row">
        <h2 id="nv-sound-settings-title" class="nv-sound-settings-overlay__title">Sound Settings</h2>
        <button type="button" data-action="close">Close</button>
      </div>
      <p class="nv-sound-settings-overlay__text">
        Optional quiet background tones for focus. This is not medical treatment.
      </p>

      <label class="nv-sound-settings-overlay__toggle">
        <input type="checkbox" name="focusAudioEnabled" />
        Enable focus background audio
      </label>

      <div class="nv-sound-settings-overlay__field" style="margin-bottom: 10px;">
        <span>Volume</span>
        <div class="nv-sound-settings-overlay__volume">
          <input type="range" name="volume" min="0" max="0.15" step="0.001" />
          <span data-volume-label>0.035</span>
        </div>
      </div>

      <div class="nv-sound-settings-overlay__grid">
        <label class="nv-sound-settings-overlay__field">
          <span>Base Min Hz</span>
          <input type="number" name="baseMinHz" min="80" max="600" step="1" />
        </label>
        <label class="nv-sound-settings-overlay__field">
          <span>Base Max Hz</span>
          <input type="number" name="baseMaxHz" min="80" max="800" step="1" />
        </label>
        <label class="nv-sound-settings-overlay__field">
          <span>Beat Min Hz</span>
          <input type="number" name="beatMinHz" min="1" max="30" step="1" />
        </label>
        <label class="nv-sound-settings-overlay__field">
          <span>Beat Max Hz</span>
          <input type="number" name="beatMaxHz" min="1" max="40" step="1" />
        </label>
        <label class="nv-sound-settings-overlay__field">
          <span>Randomize Every (ms)</span>
          <input type="number" name="changeEveryMs" min="5000" max="300000" step="1000" />
        </label>
      </div>

      <div class="nv-sound-settings-overlay__actions">
        <button type="button" data-action="start">Start</button>
        <button type="button" data-action="stop">Stop</button>
        <button type="button" data-action="save">Save</button>
        <button type="button" data-action="close">Close</button>
      </div>

      <div class="nv-sound-settings-overlay__status" data-status></div>
    </section>
  `;

  return wrapper;
}

function readSettingsFromControls(root) {
  const fromUI = {
    focusAudioEnabled: Boolean(root.querySelector('input[name="focusAudioEnabled"]')?.checked),
    volume: Number(root.querySelector('input[name="volume"]')?.value),
    baseMinHz: Number(root.querySelector('input[name="baseMinHz"]')?.value),
    baseMaxHz: Number(root.querySelector('input[name="baseMaxHz"]')?.value),
    beatMinHz: Number(root.querySelector('input[name="beatMinHz"]')?.value),
    beatMaxHz: Number(root.querySelector('input[name="beatMaxHz"]')?.value),
    changeEveryMs: Number(root.querySelector('input[name="changeEveryMs"]')?.value),
  };

  return sanitizeSoundSettings(fromUI);
}

function applySettingsToControls(root, settings) {
  root.querySelector('input[name="focusAudioEnabled"]').checked = Boolean(settings.focusAudioEnabled);
  root.querySelector('input[name="volume"]').value = String(settings.volume);
  root.querySelector('input[name="baseMinHz"]').value = String(settings.baseMinHz);
  root.querySelector('input[name="baseMaxHz"]').value = String(settings.baseMaxHz);
  root.querySelector('input[name="beatMinHz"]').value = String(settings.beatMinHz);
  root.querySelector('input[name="beatMaxHz"]').value = String(settings.beatMaxHz);
  root.querySelector('input[name="changeEveryMs"]').value = String(settings.changeEveryMs);

  const label = root.querySelector("[data-volume-label]");
  if (label) {
    label.textContent = settings.volume.toFixed(3);
  }
}

function setStatus(root, message, kind = "info") {
  const el = root.querySelector("[data-status]");
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind;
}

function updatePlaybackButtons(root) {
  const enabled = Boolean(root.querySelector('input[name="focusAudioEnabled"]')?.checked);
  const startButton = root.querySelector('[data-action="start"]');
  const stopButton = root.querySelector('[data-action="stop"]');
  const playing = isBinauralFocusPlaying();

  if (startButton) {
    startButton.disabled = !enabled || playing;
  }
  if (stopButton) {
    stopButton.disabled = !playing;
  }
}

async function loadSoundSettingsFromApi() {
  const response = await fetch("/api/sound-settings", {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load settings (${response.status})`);
  }

  const payload = await response.json();
  return sanitizeSoundSettings(payload);
}

async function saveSoundSettingsToApi(settings) {
  const response = await fetch("/api/sound-settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(settings),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Failed to save settings (${response.status})`);
  }

  return sanitizeSoundSettings(payload.settings || payload);
}

export async function openSoundSettingsOverlay() {
  ensureStyles();

  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const overlay = createOverlayMarkup();
  document.body.appendChild(overlay);

  let settings = { ...DEFAULT_SOUND_SETTINGS };

  const closeOverlay = () => {
    document.removeEventListener("keydown", handleEscape);
    overlay.remove();
  };

  const handleEscape = (event) => {
    if (event.key === "Escape") {
      closeOverlay();
    }
  };

  const refreshUiState = () => {
    applySettingsToControls(overlay, settings);
    updatePlaybackButtons(overlay);
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });

  overlay.querySelectorAll('[data-action="close"]').forEach((button) => {
    button.addEventListener("click", closeOverlay);
  });

  overlay.querySelector('input[name="focusAudioEnabled"]')?.addEventListener("change", () => {
    settings = readSettingsFromControls(overlay);
    if (!settings.focusAudioEnabled && isBinauralFocusPlaying()) {
      stopBinauralFocus();
      setStatus(overlay, "Focus background audio stopped because it was disabled.");
    }
    refreshUiState();
  });

  overlay.querySelector('input[name="volume"]')?.addEventListener("input", () => {
    settings = readSettingsFromControls(overlay);
    setBinauralVolume(settings.volume);
    refreshUiState();
  });

  overlay.querySelector('[data-action="start"]')?.addEventListener("click", async () => {
    settings = readSettingsFromControls(overlay);
    if (!settings.focusAudioEnabled) {
      setStatus(overlay, "Enable focus background audio before starting.", "error");
      refreshUiState();
      return;
    }

    try {
      applyBinauralSettings(settings);
      await startBinauralFocus(settings);
      setStatus(overlay, "Focus background audio started.", "success");
    } catch (err) {
      console.error("Unable to start focus background audio:", err);
      setStatus(overlay, err?.message || "Unable to start focus background audio.", "error");
    }

    refreshUiState();
  });

  overlay.querySelector('[data-action="stop"]')?.addEventListener("click", () => {
    stopBinauralFocus();
    setStatus(overlay, "Focus background audio stopped.");
    refreshUiState();
  });

  overlay.querySelector('[data-action="save"]')?.addEventListener("click", async () => {
    settings = readSettingsFromControls(overlay);

    try {
      const saved = await saveSoundSettingsToApi(settings);
      settings = saved;
      applyBinauralSettings(settings);
      if (!settings.focusAudioEnabled && isBinauralFocusPlaying()) {
        stopBinauralFocus();
      }
      setStatus(overlay, "Sound settings saved.", "success");
    } catch (err) {
      console.error("Unable to save sound settings:", err);
      setStatus(overlay, err?.message || "Unable to save sound settings.", "error");
    }

    refreshUiState();
  });

  document.addEventListener("keydown", handleEscape);
  overlay.focus();

  setStatus(overlay, "Loading sound settings...");
  try {
    settings = await loadSoundSettingsFromApi();
    applyBinauralSettings(settings);
    setStatus(overlay, "Sound settings loaded.", "success");
  } catch (err) {
    console.warn("Falling back to default sound settings:", err);
    settings = { ...DEFAULT_SOUND_SETTINGS };
    applyBinauralSettings(settings);
    setStatus(overlay, "Using default sound settings.", "error");
  }

  refreshUiState();
}

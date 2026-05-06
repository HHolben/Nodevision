// Nodevision/ApplicationSystem/public/Audio/BinauralFocusPlayer.mjs
// This file manages optional focus background audio playback using the Web Audio API with randomized binaural frequency variation and safe start/stop controls.

import { DEFAULT_SOUND_SETTINGS, sanitizeSoundSettings } from "../Settings/soundSettingsModel.mjs";

let audioContext = null;
let masterGain = null;
let channelMerger = null;
let leftGain = null;
let rightGain = null;
let leftOscillator = null;
let rightOscillator = null;
let randomizationTimer = null;
let playing = false;
let startInFlight = false;
let currentSettings = { ...DEFAULT_SOUND_SETTINGS };

function clearRandomizationTimer() {
  if (randomizationTimer) {
    clearInterval(randomizationTimer);
    randomizationTimer = null;
  }
}

function randomBetween(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return min;
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

function setMasterGainValue(value, rampSeconds = 0.08) {
  if (!audioContext || !masterGain) return;
  const now = audioContext.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setTargetAtTime(value, now, rampSeconds);
}

function retuneOscillators(baseHz, beatHz) {
  if (!audioContext || !leftOscillator || !rightOscillator) return;

  const now = audioContext.currentTime;
  const rightHz = baseHz + beatHz;
  const timeConstant = 0.55;

  leftOscillator.frequency.cancelScheduledValues(now);
  rightOscillator.frequency.cancelScheduledValues(now);
  leftOscillator.frequency.setTargetAtTime(baseHz, now, timeConstant);
  rightOscillator.frequency.setTargetAtTime(rightHz, now, timeConstant);
}

function randomizeFrequencies() {
  const baseHz = randomBetween(currentSettings.baseMinHz, currentSettings.baseMaxHz);
  const beatHz = randomBetween(currentSettings.beatMinHz, currentSettings.beatMaxHz);
  retuneOscillators(baseHz, beatHz);
}

function restartRandomizationLoop() {
  clearRandomizationTimer();
  if (!playing) return;

  randomizationTimer = setInterval(() => {
    if (!playing) return;
    randomizeFrequencies();
  }, currentSettings.changeEveryMs);
}

function disconnectNode(node) {
  if (!node || typeof node.disconnect !== "function") return;
  try {
    node.disconnect();
  } catch {
    // Ignore disconnect errors for already-detached nodes.
  }
}

function teardownCurrentGraph() {
  clearRandomizationTimer();

  if (leftOscillator) {
    try {
      leftOscillator.stop();
    } catch {
      // Ignore stop errors for already-stopped oscillators.
    }
  }

  if (rightOscillator) {
    try {
      rightOscillator.stop();
    } catch {
      // Ignore stop errors for already-stopped oscillators.
    }
  }

  disconnectNode(leftOscillator);
  disconnectNode(rightOscillator);
  disconnectNode(leftGain);
  disconnectNode(rightGain);
  disconnectNode(channelMerger);
  disconnectNode(masterGain);

  leftOscillator = null;
  rightOscillator = null;
  leftGain = null;
  rightGain = null;
  channelMerger = null;
  masterGain = null;
  playing = false;
}

async function ensureAudioContext() {
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      throw new Error("Web Audio API is not supported in this browser.");
    }
    audioContext = new Ctx();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  return audioContext;
}

function buildAudioGraph() {
  if (!audioContext) return;

  leftOscillator = audioContext.createOscillator();
  rightOscillator = audioContext.createOscillator();
  leftGain = audioContext.createGain();
  rightGain = audioContext.createGain();
  channelMerger = audioContext.createChannelMerger(2);
  masterGain = audioContext.createGain();

  leftOscillator.type = "sine";
  rightOscillator.type = "sine";
  leftGain.gain.value = 1;
  rightGain.gain.value = 1;
  masterGain.gain.value = 0;

  leftOscillator.connect(leftGain);
  rightOscillator.connect(rightGain);
  leftGain.connect(channelMerger, 0, 0);
  rightGain.connect(channelMerger, 0, 1);
  channelMerger.connect(masterGain);
  masterGain.connect(audioContext.destination);

  leftOscillator.start();
  rightOscillator.start();
}

export async function startBinauralFocus(settings = {}) {
  if (startInFlight) return false;
  startInFlight = true;

  try {
    currentSettings = sanitizeSoundSettings({ ...currentSettings, ...settings });

    if (playing) {
      applyBinauralSettings(currentSettings);
      return true;
    }

    await ensureAudioContext();
    buildAudioGraph();
    setMasterGainValue(currentSettings.volume, 0.06);

    playing = true;
    randomizeFrequencies();
    restartRandomizationLoop();

    return true;
  } finally {
    startInFlight = false;
  }
}

export function stopBinauralFocus() {
  if (!playing && !leftOscillator && !rightOscillator) return;
  teardownCurrentGraph();
}

export function setBinauralVolume(volume) {
  currentSettings = sanitizeSoundSettings({ ...currentSettings, volume });
  setMasterGainValue(currentSettings.volume, 0.06);
}

export function isBinauralFocusPlaying() {
  return playing;
}

export function applyBinauralSettings(settings = {}) {
  currentSettings = sanitizeSoundSettings({ ...currentSettings, ...settings });

  if (masterGain) {
    setMasterGainValue(currentSettings.volume, 0.08);
  }

  if (playing) {
    randomizeFrequencies();
    restartRandomizationLoop();
  }

  return { ...currentSettings };
}

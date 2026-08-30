// Nodevision/ApplicationSystem/public/Speech/SpeechRecognitionService.mjs
// This module coordinates shared speech-recognition provider selection, lifecycle events, and cleanup for dictation callers.

import { emitNodevisionEvent } from "../Commands/NodevisionEventRegistry.mjs";
import { createUtteranceId } from "./SpeechEventNormalizer.mjs";
import { normalizeSpeechRecognitionEvent, recognitionEventName } from "./SpeechRecognitionEventNormalizer.mjs";
import { SpeechRecognitionProviderRegistry } from "./SpeechRecognitionProviderRegistry.mjs";
import { createBrowserSpeechRecognitionProvider } from "./providers/BrowserSpeechRecognitionProvider.mjs";
import { createWhisperCppRecognitionProvider } from "./providers/WhisperCppRecognitionProvider.mjs";

function defaultProviders(target = globalThis.window || globalThis) {
  return [createWhisperCppRecognitionProvider(target), createBrowserSpeechRecognitionProvider(target)];
}

function localSetting(target, key, fallback = "") {
  try {
    return target?.localStorage?.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

async function fetchRecognitionSettings(target = globalThis.window || globalThis) {
  const fallback = {
    providerId: localSetting(target, "nodevision.speechRecognition.provider", "whisper-cpp"),
    allowBrowserRecognition: localSetting(target, "nodevision.speechRecognition.allowBrowser", "false") === "true",
    language: target.navigator?.language || "en-US",
  };
  try {
    const response = await fetch("/api/speech/recognition/settings", {
      method: "GET",
      credentials: "same-origin",
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) return fallback;
    return { ...fallback, ...(payload.settings || {}) };
  } catch {
    return fallback;
  }
}

export class SpeechRecognitionService {
  constructor(options = {}) {
    this.target = options.target || globalThis.window || null;
    this.registry = options.registry || new SpeechRecognitionProviderRegistry(options.providers || defaultProviders(this.target || globalThis));
    this.settingsProvider = options.settingsProvider || (() => fetchRecognitionSettings(this.target || globalThis));
    this.active = null;
    this.removeCleanup = null;
  }

  registerCleanup(context = {}) {
    if (this.removeCleanup) return;
    const addCleanup = context.executionContext?.addCleanup;
    if (typeof addCleanup !== "function") return;
    this.removeCleanup = addCleanup(() => {
      if (this.active) this.cancelRecognition("session-cleanup");
    });
  }

  cleanupRegistration() {
    this.removeCleanup?.();
    this.removeCleanup = null;
  }

  async startRecognition(context = {}) {
    this.registerCleanup(context);
    if (this.active) throw new Error("Speech recognition is already active.");
    const settings = await this.settingsProvider();
    const providerId = context.providerId || settings.providerId || "whisper-cpp";
    const allowOnline = context.allowBrowserRecognition === true || settings.allowBrowserRecognition === true;
    const selected = await this.registry.select({ providerId, allowOnline, requirements: { recognition: true } });
    if (!selected.provider) throw new Error(selected.status?.reason || "No usable offline speech-recognition provider is available.");

    const utteranceId = createUtteranceId("dictation");
    const active = {
      utteranceId,
      provider: selected.provider,
      providerId: selected.provider.id,
      source: context.source || "dictation",
      callbacks: {
        onEvent: context.onEvent,
        onPartialText: context.onPartialText,
        onFinalText: context.onFinalText,
        onState: context.onState,
      },
    };
    this.active = active;
    const onEvent = (eventName, raw) => this.handleProviderEvent(eventName, raw, utteranceId);
    try {
      const result = await selected.provider.startRecognition({
        ...context,
        utteranceId,
        language: context.language || settings.language,
        onEvent,
      });
      return { ok: true, utteranceId, provider: selected.provider.id, capabilities: selected.provider.capabilities, ...result };
    } catch (err) {
      this.active = null;
      this.cleanupRegistration();
      throw err;
    }
  }

  handleProviderEvent(rawName, raw = {}, utteranceId = null) {
    const eventName = recognitionEventName(rawName);
    if (!eventName || !this.active || this.active.utteranceId !== utteranceId) return null;
    const detail = normalizeSpeechRecognitionEvent(eventName, raw, this.active);
    emitNodevisionEvent(eventName, detail, this.target);
    this.active.callbacks.onEvent?.(eventName, detail);
    if (eventName === "speech.recognition.partial") this.active.callbacks.onPartialText?.(detail.text, detail);
    if (eventName === "speech.recognition.final") this.active.callbacks.onFinalText?.(detail.text, detail);
    if (eventName === "speech.recognition.processing") this.active.callbacks.onState?.("processing", detail);
    if (["speech.recognition.finished", "speech.recognition.cancelled", "speech.recognition.error"].includes(eventName)) this.finishRecognition(utteranceId);
    return detail;
  }

  async stopRecognition(reason = "command") {
    const active = this.active;
    if (!active) return { ok: true, active: false };
    return active.provider.stopRecognition?.({ utteranceId: active.utteranceId, reason, finalize: true }) || { ok: true };
  }

  async cancelRecognition(reason = "command") {
    const active = this.active;
    if (!active) return { ok: true, active: false };
    this.active = null;
    try {
      await active.provider.stopRecognition?.({ utteranceId: active.utteranceId, reason, finalize: false });
    } catch {}
    const detail = normalizeSpeechRecognitionEvent("speech.recognition.cancelled", { reason }, active);
    emitNodevisionEvent("speech.recognition.cancelled", detail, this.target);
    active.callbacks.onEvent?.("speech.recognition.cancelled", detail);
    this.cleanupRegistration();
    return { ok: true, utteranceId: active.utteranceId, provider: active.providerId };
  }

  finishRecognition(utteranceId) {
    if (this.active?.utteranceId === utteranceId) this.active = null;
    this.cleanupRegistration();
  }

  isRecognitionActive() {
    return Boolean(this.active);
  }

  getRecognitionState() {
    if (!this.active) return { ok: true, active: false };
    return { ok: true, active: true, utteranceId: this.active.utteranceId, provider: this.active.providerId };
  }
}

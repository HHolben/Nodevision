// Nodevision/ApplicationSystem/public/Speech/SpeechService.mjs
// This module coordinates shared Nodevision speech commands, provider selection, normalized events, utterance state, and Session cleanup.

import { emitNodevisionEvent } from "../Commands/NodevisionEventRegistry.mjs";
import { normalizeSpeechEvent, createUtteranceId, normalizeSpeechRate } from "./SpeechEventNormalizer.mjs";
import { SpeechProviderRegistry } from "./SpeechProviderRegistry.mjs";
import { segmentSpeechText } from "./SpeechTextSegments.mjs";
import { createBrowserSpeechProvider } from "./providers/BrowserSpeechProvider.mjs";
import { createEspeakNativeSpeechProvider, createLinuxNativeSpeechProvider } from "./providers/LinuxNativeSpeechProvider.mjs";

function providerPreference(target = globalThis.window) {
  try {
    return target?.localStorage?.getItem("nodevision.speech.provider") || "automatic";
  } catch {
    return "automatic";
  }
}

function defaultProviders(target = globalThis.window || globalThis) {
  return [createEspeakNativeSpeechProvider(), createLinuxNativeSpeechProvider(), createBrowserSpeechProvider(target)];
}

export class SpeechService {
  constructor(options = {}) {
    this.target = options.target || globalThis.window || null;
    this.registry = options.registry || new SpeechProviderRegistry(options.providers || defaultProviders(this.target || globalThis));
    this.rate = normalizeSpeechRate(options.rate ?? 1);
    this.active = null;
    this.removeCleanup = null;
  }

  registerCleanup(context = {}) {
    if (this.removeCleanup) return;
    const addCleanup = context.executionContext?.addCleanup;
    if (typeof addCleanup !== "function") return;
    this.removeCleanup = addCleanup(() => {
      if (this.active) this.cancelActive("session-cleanup");
    });
  }

  cleanupRegistration() {
    this.removeCleanup?.();
    this.removeCleanup = null;
  }

  async speak(text, context = {}) {
    this.registerCleanup(context);
    if (this.active) await this.cancelActive("superseded");
    const segments = segmentSpeechText(text);
    const utteranceId = createUtteranceId();
    const requirements = context.speechRequirements || context.requireSpeechCapabilities || {};
    const selected = await this.registry.select({ providerId: providerPreference(this.target), requirements });
    if (!selected.provider) throw new Error(selected.status?.reason || "No usable offline speech provider is available.");
    const active = { utteranceId, provider: selected.provider, providerId: selected.provider.id, segments };
    this.active = active;
    const onEvent = (eventName, raw) => this.handleProviderEvent(eventName, raw, utteranceId);
    await selected.provider.speak(segments.text, { utteranceId, rate: this.rate, segments, onEvent });
    return {
      ok: true,
      utteranceId,
      provider: selected.provider.id,
      textLength: segments.textLength,
      tokenCount: segments.tokens.length,
      offsetUnit: segments.offsetUnit,
      rate: this.rate,
      capabilities: { ...(selected.provider.capabilities || {}) },
    };
  }

  handleProviderEvent(eventName, raw = {}, utteranceId = null) {
    if (!this.active || this.active.utteranceId !== utteranceId) return null;
    const detail = normalizeSpeechEvent(eventName, raw, { ...this.active, rate: this.rate });
    emitNodevisionEvent(eventName, detail, this.target);
    if (eventName === "speech.error") emitNodevisionEvent("speech.cancelled", { ...detail, reason: detail.reason || "error" }, this.target);
    if (["speech.finished", "speech.cancelled", "speech.error"].includes(eventName)) this.finishActive(utteranceId);
    return detail;
  }

  async cancelActive(reason = "command") {
    const active = this.active;
    if (!active) return { ok: true, active: false };
    this.active = null;
    let stopPromise = Promise.resolve();
    try {
      stopPromise = Promise.resolve(active.provider.stop?.({ utteranceId: active.utteranceId, reason })).catch(() => {});
    } catch {}
    const detail = normalizeSpeechEvent("speech.cancelled", { reason }, { ...active, rate: this.rate });
    emitNodevisionEvent("speech.cancelled", detail, this.target);
    this.cleanupRegistration();
    await stopPromise;
    return { ok: true, utteranceId: active.utteranceId, provider: active.providerId };
  }

  finishActive(utteranceId) {
    if (this.active?.utteranceId === utteranceId) this.active = null;
    this.cleanupRegistration();
  }

  async pause() {
    if (!this.active) return { ok: true, active: false };
    if (!this.active.provider.capabilities?.pause) throw new Error(`Speech provider ${this.active.providerId} does not support pause.`);
    await this.active.provider.pause();
    const detail = normalizeSpeechEvent("speech.paused", { reason: "command" }, { ...this.active, rate: this.rate });
    emitNodevisionEvent("speech.paused", detail, this.target);
    return { ok: true, utteranceId: this.active.utteranceId };
  }

  async resume() {
    if (!this.active) return { ok: true, active: false };
    if (!this.active.provider.capabilities?.resume) throw new Error(`Speech provider ${this.active.providerId} does not support resume.`);
    await this.active.provider.resume();
    const detail = normalizeSpeechEvent("speech.resumed", { reason: "command" }, { ...this.active, rate: this.rate });
    emitNodevisionEvent("speech.resumed", detail, this.target);
    return { ok: true, utteranceId: this.active.utteranceId };
  }

  setRate(rate) {
    this.rate = normalizeSpeechRate(rate);
    return { ok: true, rate: this.rate };
  }
}

let sharedSpeechService = null;

export function getSpeechService() {
  if (!sharedSpeechService) sharedSpeechService = new SpeechService();
  return sharedSpeechService;
}

export function resetSpeechServiceForTests(service = null) {
  sharedSpeechService = service;
}

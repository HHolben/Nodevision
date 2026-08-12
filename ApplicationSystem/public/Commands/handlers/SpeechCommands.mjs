// Nodevision/ApplicationSystem/public/Commands/handlers/SpeechCommands.mjs
// This module exposes browser-native speech synthesis as shared Nodevision commands without faking timing events.

import { emitNodevisionEvent } from "../NodevisionEventRegistry.mjs";

const state = { rate: 1, utterance: null, cancelling: false, removeCleanup: null };

function synth() {
  const api = globalThis.speechSynthesis;
  const Utterance = globalThis.SpeechSynthesisUtterance;
  if (!api || typeof Utterance !== "function") throw new Error("Browser speech synthesis is not available.");
  return { api, Utterance };
}

function cleanUtterance(utterance) {
  if (state.utterance === utterance) state.utterance = null;
  state.cancelling = false;
  state.removeCleanup?.();
  state.removeCleanup = null;
}

function detailFor(event, text = "") {
  return {
    charIndex: Number.isFinite(event?.charIndex) ? event.charIndex : null,
    charLength: Number.isFinite(event?.charLength) ? event.charLength : null,
    elapsedTime: Number.isFinite(event?.elapsedTime) ? event.elapsedTime : null,
    name: event?.name || "",
    textLength: text.length,
    rate: state.rate,
  };
}

function registerCleanup(context) {
  if (state.removeCleanup) return;
  const cleanup = context.executionContext?.addCleanup;
  if (typeof cleanup !== "function") return;
  state.removeCleanup = cleanup(() => {
    if (!state.utterance) return;
    state.cancelling = true;
    try { globalThis.speechSynthesis?.cancel?.(); } catch {}
    emitNodevisionEvent("speech.cancelled", { reason: "session-cleanup" });
    state.utterance = null;
    state.removeCleanup = null;
  });
}

export function speakCommand([text], context = {}) {
  const { api, Utterance } = synth();
  registerCleanup(context);
  if (state.utterance) {
    state.cancelling = true;
    api.cancel();
  }
  const utterance = new Utterance(text);
  utterance.rate = state.rate;
  state.utterance = utterance;
  state.cancelling = false;
  utterance.onstart = (event) => emitNodevisionEvent("speech.started", detailFor(event, text));
  utterance.onboundary = (event) => emitNodevisionEvent("speech.boundary", detailFor(event, text));
  utterance.onpause = (event) => emitNodevisionEvent("speech.paused", detailFor(event, text));
  utterance.onresume = (event) => emitNodevisionEvent("speech.resumed", detailFor(event, text));
  utterance.onend = (event) => {
    emitNodevisionEvent(state.cancelling ? "speech.cancelled" : "speech.finished", detailFor(event, text));
    cleanUtterance(utterance);
  };
  utterance.onerror = (event) => {
    emitNodevisionEvent("speech.cancelled", { ...detailFor(event, text), error: event?.error || "speech-error" });
    cleanUtterance(utterance);
  };
  api.speak(utterance);
  return { ok: true, textLength: text.length, rate: state.rate };
}

export function stopSpeechCommand() {
  const { api } = synth();
  state.cancelling = true;
  api.cancel();
  emitNodevisionEvent("speech.cancelled", { reason: "command" });
  cleanUtterance(state.utterance);
  return { ok: true };
}

export function pauseSpeechCommand() {
  const { api } = synth();
  api.pause();
  emitNodevisionEvent("speech.paused", { reason: "command" });
  return { ok: true };
}

export function resumeSpeechCommand() {
  const { api } = synth();
  api.resume();
  emitNodevisionEvent("speech.resumed", { reason: "command" });
  return { ok: true };
}

export function setSpeechRateCommand([rate]) {
  state.rate = Math.max(0.1, Math.min(10, Number(rate) || 1));
  return { ok: true, rate: state.rate };
}

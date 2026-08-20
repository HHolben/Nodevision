// Nodevision/ApplicationSystem/public/Speech/SpeechEventNormalizer.mjs
// This module converts provider-specific speech callbacks into stable Nodevision speech event payloads with utterance identity and explicit boundary provenance.

import { SPEECH_OFFSET_UNIT, tokenAtCharIndex, tokenByProviderIndex } from "./SpeechTextSegments.mjs";

let utteranceSequence = 0;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedToken(event = {}, segments) {
  if (Number.isFinite(Number(event.charIndex))) return tokenAtCharIndex(segments, Number(event.charIndex));
  if (Number.isInteger(Number(event.tokenIndex))) return tokenByProviderIndex(segments, Number(event.tokenIndex));
  return null;
}

export function createUtteranceId(prefix = "speech") {
  utteranceSequence += 1;
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${utteranceSequence.toString(36)}`;
}

export function normalizeSpeechRate(rate, fallback = 1) {
  const value = Number(rate);
  const numeric = Number.isFinite(value) ? value : fallback;
  return Math.max(0.1, Math.min(10, numeric));
}

export function normalizeSpeechEvent(eventName, raw = {}, context = {}) {
  const segments = context.segments || null;
  const token = normalizedToken(raw, segments);
  const providerCharIndex = finite(raw.charIndex);
  const tokenCharIndex = token && Number.isInteger(Number(raw.tokenIndex)) ? token.charIndex : null;
  const charIndex = providerCharIndex ?? tokenCharIndex;
  const charLength = finite(raw.charLength) ?? (token ? token.charLength : null);
  const word = raw.word || token?.word || null;
  let boundaryStatus = null;
  if (eventName === "speech.boundary") {
    boundaryStatus = charIndex !== null ? "position-known" : word ? "word-known" : "position-unknown";
  }
  return {
    provider: context.providerId || raw.provider || "unknown",
    utteranceId: context.utteranceId || raw.utteranceId || null,
    charIndex,
    charLength,
    word,
    boundaryStatus,
    positionSource: raw.positionSource || (providerCharIndex !== null ? "provider-char-index" : tokenCharIndex !== null ? "provider-token-index" : null),
    boundaryKind: raw.boundaryKind || raw.boundaryType || raw.name || null,
    elapsedTime: finite(raw.elapsedTime),
    audioPositionMs: finite(raw.audioPositionMs),
    nativeTextPosition: finite(raw.nativeTextPosition),
    nativeTextLength: finite(raw.nativeTextLength),
    nativeUniqueIdentifier: finite(raw.nativeUniqueIdentifier),
    nativeWordNumber: finite(raw.nativeWordNumber),
    textLength: segments?.textLength ?? finite(raw.textLength),
    offsetUnit: SPEECH_OFFSET_UNIT,
    rate: finite(context.rate ?? raw.rate),
    reason: raw.reason || null,
    error: raw.error || null,
  };
}

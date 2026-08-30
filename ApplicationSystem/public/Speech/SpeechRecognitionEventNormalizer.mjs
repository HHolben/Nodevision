// Nodevision/ApplicationSystem/public/Speech/SpeechRecognitionEventNormalizer.mjs
// This module converts speech-recognition provider callbacks into stable Nodevision recognition event payloads.

const EVENT_TYPES = Object.freeze({
  "speech.recognition.started": "started",
  "speech.recognition.partial": "partial",
  "speech.recognition.processing": "processing",
  "speech.recognition.final": "final",
  "speech.recognition.finished": "finished",
  "speech.recognition.cancelled": "cancelled",
  "speech.recognition.error": "error",
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textValue(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function recognitionEventName(type = "") {
  const normalized = String(type || "").trim();
  if (normalized.startsWith("speech.recognition.")) return normalized;
  return Object.entries(EVENT_TYPES).find((entry) => entry[1] === normalized)?.[0] || null;
}

export function normalizeSpeechRecognitionEvent(eventName, raw = {}, context = {}) {
  return {
    provider: context.providerId || raw.provider || "unknown",
    utteranceId: context.utteranceId || raw.utteranceId || null,
    source: context.source || raw.source || null,
    text: textValue(raw.text || raw.transcript),
    partial: eventName === "speech.recognition.partial",
    final: eventName === "speech.recognition.final",
    elapsedTime: finite(raw.elapsedTime),
    confidence: finite(raw.confidence),
    reason: raw.reason || null,
    error: raw.error || null,
  };
}

// Nodevision/ApplicationSystem/public/Speech/providers/BrowserSpeechProvider.mjs
// This module wraps browser Web Speech synthesis as one provider behind Nodevision's shared SpeechService provider contract.

function voicesFrom(api) {
  try {
    const voices = api?.getVoices?.();
    return Array.isArray(voices) ? voices : [];
  } catch {
    return [];
  }
}

function waitForVoices(api, timeoutMs = 700) {
  const initial = voicesFrom(api);
  if (initial.length) return Promise.resolve(initial);
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      api.removeEventListener?.("voiceschanged", done);
      resolve(voicesFrom(api));
    };
    api.addEventListener?.("voiceschanged", done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

export function createBrowserSpeechProvider(target = globalThis) {
  let active = null;
  const provider = {
    id: "browser",
    label: "Browser Web Speech",
    kind: "browser",
    capabilities: { pause: true, resume: true, rate: true, wordBoundary: true, charIndex: true, offline: false },

    async isAvailable() {
      const api = target.speechSynthesis;
      const Utterance = target.SpeechSynthesisUtterance;
      if (!api || typeof Utterance !== "function") {
        return { available: false, reason: "Browser Web Speech objects are not present." };
      }
      const voices = await waitForVoices(api);
      if (!voices.length) return { available: false, reason: "Browser Web Speech has no usable voices loaded." };
      return { available: true, voiceCount: voices.length };
    },

    async speak(text, options = {}) {
      const api = target.speechSynthesis;
      const Utterance = target.SpeechSynthesisUtterance;
      if (!api || typeof Utterance !== "function") throw new Error("Browser speech synthesis is not available.");
      if (active) api.cancel?.();
      const utterance = new Utterance(String(text ?? ""));
      utterance.rate = options.rate || 1;
      active = { utterance, utteranceId: options.utteranceId, onEvent: options.onEvent };
      const relay = (type) => (event = {}) => {
        if (active?.utterance !== utterance) return;
        options.onEvent?.(type, {
          charIndex: event.charIndex,
          charLength: event.charLength,
          elapsedTime: event.elapsedTime,
          name: event.name,
          error: event.error,
        });
        if (type === "speech.finished" || type === "speech.error") active = null;
      };
      utterance.onstart = relay("speech.started");
      utterance.onboundary = relay("speech.boundary");
      utterance.onpause = relay("speech.paused");
      utterance.onresume = relay("speech.resumed");
      utterance.onend = relay("speech.finished");
      utterance.onerror = relay("speech.error");
      api.speak(utterance);
      return { ok: true, provider: provider.id, utteranceId: options.utteranceId };
    },

    async stop() {
      const api = target.speechSynthesis;
      active = null;
      api?.cancel?.();
      return { ok: true };
    },

    async pause() {
      target.speechSynthesis?.pause?.();
      return { ok: true };
    },

    async resume() {
      target.speechSynthesis?.resume?.();
      return { ok: true };
    },
  };
  return provider;
}

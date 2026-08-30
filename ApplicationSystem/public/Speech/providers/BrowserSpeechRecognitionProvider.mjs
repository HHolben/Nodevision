// Nodevision/ApplicationSystem/public/Speech/providers/BrowserSpeechRecognitionProvider.mjs
// This module wraps browser SpeechRecognition as an explicit opt-in recognition provider because implementations may use external services.

function speechRecognitionConstructor(target = globalThis.window || globalThis) {
  return target.SpeechRecognition || target.webkitSpeechRecognition || null;
}

function collectTranscript(event, finalOnly) {
  let text = "";
  for (let i = event.resultIndex || 0; i < event.results.length; i += 1) {
    const result = event.results[i];
    if (!result) continue;
    if (finalOnly && !result.isFinal) continue;
    if (!finalOnly && result.isFinal) continue;
    text += result[0]?.transcript || "";
  }
  return text.trim();
}

function recognitionError(rawError) {
  const error = String(rawError || "").trim() || "unknown";
  if (error === "network") return "Browser speech recognition could not reach its recognition service.";
  if (error === "not-allowed" || error === "service-not-allowed") return "Microphone permission was denied.";
  if (error === "audio-capture") return "No microphone was available.";
  if (error === "no-speech") return "No speech was detected.";
  if (error === "aborted") return "Recognition was stopped.";
  return `Browser speech recognition stopped: ${error}.`;
}

export function createBrowserSpeechRecognitionProvider(target = globalThis.window || globalThis) {
  let active = null;

  function emit(record, eventName, detail = {}) {
    record.onEvent?.(eventName, { provider: "browser-recognition", utteranceId: record.utteranceId, ...detail });
  }

  return {
    id: "browser-recognition",
    label: "Browser SpeechRecognition",
    kind: "browser",
    capabilities: { recognition: true, partial: true, final: true, cancel: true, offline: false },

    isAvailable() {
      return {
        available: Boolean(speechRecognitionConstructor(target)),
        reason: speechRecognitionConstructor(target) ? "" : "Browser SpeechRecognition is not available.",
      };
    },

    async startRecognition(options = {}) {
      if (active) await this.stopRecognition({ reason: "superseded", finalize: false });
      const Recognition = speechRecognitionConstructor(target);
      if (!Recognition) throw new Error("Browser SpeechRecognition is not available.");
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = options.language || target.navigator?.language || "en-US";
      active = { recognition, utteranceId: String(options.utteranceId || ""), onEvent: options.onEvent, stopping: false, errored: false };

      recognition.onresult = (event) => {
        if (!active || active.recognition !== recognition) return;
        const partial = collectTranscript(event, false);
        const final = collectTranscript(event, true);
        if (partial) emit(active, "speech.recognition.partial", { text: partial });
        if (final) emit(active, "speech.recognition.final", { text: final });
      };
      recognition.onerror = (event) => {
        if (!active || active.recognition !== recognition || active.stopping) return;
        active.errored = true;
        emit(active, "speech.recognition.error", { error: recognitionError(event?.error), reason: event?.error || "error" });
        active = null;
        try { recognition.abort?.(); } catch {}
      };
      recognition.onend = () => {
        if (!active || active.recognition !== recognition) return;
        const record = active;
        active = null;
        emit(record, record.errored ? "speech.recognition.error" : "speech.recognition.finished", { reason: record.stopping ? "command" : "ended" });
      };

      try {
        recognition.start();
      } catch (err) {
        active = null;
        throw err;
      }
      emit(active, "speech.recognition.started", { state: "listening" });
      return { ok: true, provider: "browser-recognition", utteranceId: active.utteranceId, state: "listening" };
    },

    async stopRecognition({ reason = "command", finalize = true } = {}) {
      const record = active;
      if (!record?.recognition) return { ok: true, active: false };
      record.stopping = true;
      try {
        if (finalize) record.recognition.stop();
        else record.recognition.abort?.();
      } catch {
        active = null;
        emit(record, "speech.recognition.cancelled", { reason });
      }
      return { ok: true, state: finalize ? "stopping" : "cancelled" };
    },
  };
}

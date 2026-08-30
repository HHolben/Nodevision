// Nodevision/ApplicationSystem/public/Speech/providers/WhisperCppRecognitionProvider.mjs
// This module records local microphone audio as WAV chunks and sends them to Nodevision's authenticated whisper.cpp recognition route.

import { BrowserMicrophoneWavCapture } from "../BrowserMicrophoneWavCapture.mjs";

const POLL_INTERVAL_MS = 120;
const SEGMENT_MS = 12000;

async function jsonRequest(url, body = null) {
  const options = body ? {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body),
  } : { credentials: "same-origin", headers: { "Accept": "application/json" } };
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `Speech recognition request failed with ${response.status}.`);
  return payload;
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

function eventName(type = "") {
  return {
    processing: "speech.recognition.processing",
    partial: "speech.recognition.partial",
    final: "speech.recognition.final",
    cancelled: "speech.recognition.cancelled",
    error: "speech.recognition.error",
  }[type] || null;
}

function terminal(state = "") {
  return ["finished", "cancelled", "error"].includes(state);
}

export function createWhisperCppRecognitionProvider(target = globalThis.window || globalThis) {
  let active = null;

  function emit(record, name, detail = {}) {
    record.onEvent?.(name, { ...detail, provider: "whisper-cpp", utteranceId: record.utteranceId });
  }

  function clearRecordTimers(record) {
    if (record.segmentTimer) clearInterval(record.segmentTimer);
    if (record.pollTimer) clearInterval(record.pollTimer);
    record.segmentTimer = null;
    record.pollTimer = null;
  }

  async function handleError(record, err) {
    if (active !== record) return;
    clearRecordTimers(record);
    active = null;
    if (record.listening) await record.capture.stop().catch(() => {});
    emit(record, "speech.recognition.error", { error: err?.message || "whisper.cpp recognition failed." });
  }

  function queueCapture(record, capture, final = false) {
    if (capture.blob.size > 44) {
      record.heardAudio = true;
      record.queue.push({ ...capture, final, index: record.nextIndex++ });
    }
    record.finishWhenIdle = record.finishWhenIdle || final;
  }

  async function flushSegment(record, final = false) {
    if (record.flushing || active !== record) return;
    record.flushing = true;
    try {
      const capture = final ? await record.capture.stop() : record.capture.snapshot({ clear: true });
      queueCapture(record, capture, final);
      if (final && !record.heardAudio && !record.processing) throw new Error("No microphone audio was captured.");
      processQueue(record);
    } catch (err) {
      await handleError(record, err);
    } finally {
      record.flushing = false;
    }
  }

  async function pollJob(record, jobId) {
    return new Promise((resolve, reject) => {
      let cursor = 0;
      record.pollTimer = setInterval(async () => {
        try {
          const query = new URLSearchParams({ providerId: record.providerId, utteranceId: jobId, cursor: String(cursor) });
          const status = await jsonRequest(`/api/speech/recognition/status?${query.toString()}`);
          cursor = Number(status.cursor) || cursor;
          for (const event of status.events || []) {
            const name = eventName(event.type);
            if (name) emit(record, name, event);
          }
          if (!terminal(status.state)) return;
          clearInterval(record.pollTimer);
          record.pollTimer = null;
          status.state === "error" ? reject(new Error(status.error || "whisper.cpp recognition failed.")) : resolve(status.state);
        } catch (err) {
          clearInterval(record.pollTimer);
          record.pollTimer = null;
          reject(err);
        }
      }, POLL_INTERVAL_MS);
    });
  }

  async function processQueue(record) {
    if (record.processing || active !== record) return;
    const item = record.queue.shift();
    if (!item) {
      if (record.finishWhenIdle) {
        clearRecordTimers(record);
        active = null;
        emit(record, "speech.recognition.finished", { reason: "command" });
      }
      return;
    }

    record.processing = true;
    emit(record, "speech.recognition.processing", { elapsedTime: item.durationMs / 1000 });
    try {
      const jobId = `${record.utteranceId}-${item.index}`;
      record.activeJobId = jobId;
      const result = await jsonRequest("/api/speech/recognition/start", {
        providerId: record.providerId,
        utteranceId: jobId,
        audioBase64: await blobToBase64(item.blob),
        language: record.language,
      });
      record.providerId = result.providerId || record.providerId;
      await pollJob(record, jobId);
      record.activeJobId = "";
      record.processing = false;
      processQueue(record);
    } catch (err) {
      record.processing = false;
      await handleError(record, err);
    }
  }

  return {
    id: "whisper-cpp",
    label: "whisper.cpp",
    kind: "offline",
    capabilities: { recognition: true, partial: false, final: true, cancel: true, offline: true },

    async isAvailable() {
      if (!target.navigator?.mediaDevices?.getUserMedia) return { available: false, reason: "Microphone capture is not available in this browser." };
      try {
        const payload = await jsonRequest("/api/speech/recognition/providers");
        const found = (payload.providers || []).find((entry) => entry.id === "whisper-cpp");
        return { available: Boolean(found?.available), reason: found?.reason || "" };
      } catch (err) {
        return { available: false, reason: err?.message || "Local speech-recognition route is unavailable." };
      }
    },

    async startRecognition(options = {}) {
      if (active) await this.stopRecognition({ reason: "superseded", finalize: false });
      const capture = new BrowserMicrophoneWavCapture(target);
      await capture.start();
      active = { utteranceId: String(options.utteranceId || ""), providerId: "whisper-cpp", capture, onEvent: options.onEvent, language: options.language || "", cursor: 0, queue: [], nextIndex: 1, listening: true, processing: false, flushing: false, finishWhenIdle: false, heardAudio: false, segmentTimer: null, pollTimer: null };
      active.segmentTimer = setInterval(() => flushSegment(active, false), SEGMENT_MS);
      emit(active, "speech.recognition.started", { state: "listening" });
      return { ok: true, provider: "whisper-cpp", utteranceId: active.utteranceId, state: "listening" };
    },

    async stopRecognition({ reason = "command", finalize = true } = {}) {
      const record = active;
      if (!record) return { ok: true, active: false };
      if (!finalize) {
        clearRecordTimers(record);
        active = null;
        if (record.listening) await record.capture.stop().catch(() => {});
        if (record.processing && record.activeJobId) await jsonRequest("/api/speech/recognition/stop", { providerId: record.providerId, utteranceId: record.activeJobId }).catch(() => {});
        emit(record, "speech.recognition.cancelled", { reason });
        return { ok: true, state: "cancelled" };
      }
      if (record.listening) {
        record.listening = false;
        if (record.segmentTimer) clearInterval(record.segmentTimer);
        record.segmentTimer = null;
        await flushSegment(record, true);
        return { ok: true, state: "processing", utteranceId: record.utteranceId, provider: record.providerId };
      }
      clearRecordTimers(record);
      active = null;
      emit(record, "speech.recognition.cancelled", { reason });
      return { ok: true, state: "cancelled" };
    },
  };
}

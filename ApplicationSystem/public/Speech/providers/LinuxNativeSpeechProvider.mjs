// Nodevision/ApplicationSystem/public/Speech/providers/LinuxNativeSpeechProvider.mjs
// This module connects browser-side speech commands to Nodevision fixed authenticated server speech providers and relays their normalized event streams.

import { mapEspeakBoundaryEvent } from "../EspeakBoundaryMapper.mjs";

async function jsonRequest(path, body = null) {
  const options = body ? {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } : { credentials: "same-origin" };
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `Speech request failed with ${response.status}.`);
  return payload;
}

function eventName(type = "") {
  return {
    started: "speech.started",
    boundary: "speech.boundary",
    finished: "speech.finished",
    cancelled: "speech.cancelled",
    error: "speech.error",
  }[type] || null;
}

function mapProviderEvent(event, active, providerId) {
  const raw = event.type === "boundary" && providerId === "espeak-native"
    ? mapEspeakBoundaryEvent(event, active.segments)
    : event;
  return { provider: providerId, ...raw };
}

function createServerSpeechProvider(config) {
  let active = null;
  let pollTimer = null;
  const provider = {
    id: config.id,
    label: config.label,
    kind: "native",
    capabilities: { ...config.capabilities },

    async isAvailable() {
      try {
        const payload = await jsonRequest("/api/speech/providers");
        const found = (payload.providers || []).find((entry) => entry.id === provider.id);
        return { available: Boolean(found?.available), reason: found?.reason || "" };
      } catch (err) {
        return { available: false, reason: err?.message || "Native speech route unavailable." };
      }
    },

    async speak(text, options = {}) {
      this.stopPolling();
      const result = await jsonRequest("/api/speech/speak", { providerId: provider.id, text, rate: options.rate, utteranceId: options.utteranceId });
      active = { utteranceId: result.utteranceId, onEvent: options.onEvent, segments: options.segments, cursor: 0 };
      this.startPolling(active);
      return result;
    },

    async stop() {
      this.stopPolling();
      const utteranceId = active?.utteranceId;
      active = null;
      if (!utteranceId) return { ok: true };
      return jsonRequest("/api/speech/stop", { providerId: provider.id, utteranceId });
    },

    async pause() {
      throw new Error(`${provider.label} does not support pause.`);
    },

    async resume() {
      throw new Error(`${provider.label} does not support resume.`);
    },

    startPolling(record) {
      pollTimer = setInterval(async () => {
        try {
          const query = new URLSearchParams({ providerId: provider.id, utteranceId: record.utteranceId, cursor: String(record.cursor) });
          const status = await jsonRequest(`/api/speech/status?${query.toString()}`);
          record.cursor = Number(status.cursor) || record.cursor;
          for (const event of status.events || []) {
            if (active?.utteranceId !== record.utteranceId) return;
            const name = eventName(event.type);
            if (name) record.onEvent?.(name, mapProviderEvent(event, record, provider.id));
          }
          if (!["finished", "cancelled", "error"].includes(status.state)) return;
          this.stopPolling();
          active = null;
        } catch (err) {
          this.stopPolling();
          if (active?.utteranceId !== record.utteranceId) return;
          active = null;
          record.onEvent?.("speech.error", { provider: provider.id, error: err?.message || "Native speech polling failed." });
        }
      }, 120);
    },

    stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    },
  };
  return provider;
}

export function createEspeakNativeSpeechProvider() {
  return createServerSpeechProvider({
    id: "espeak-native",
    label: "eSpeak NG Native",
    capabilities: { speech: true, cancel: true, pause: false, resume: false, rate: true, wordBoundary: true, charIndex: true, audioPosition: true, offline: true },
  });
}

export function createLinuxNativeSpeechProvider() {
  return createServerSpeechProvider({
    id: "linux-native",
    label: "Linux Native Speech",
    capabilities: { speech: true, cancel: true, pause: false, resume: false, rate: true, wordBoundary: false, charIndex: false, audioPosition: false, offline: true },
  });
}

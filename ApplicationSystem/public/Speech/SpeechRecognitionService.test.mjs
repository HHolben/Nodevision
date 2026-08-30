// Nodevision/ApplicationSystem/public/Speech/SpeechRecognitionService.test.mjs
// This test validates speech-recognition lifecycle events and final transcript callbacks.

import assert from "node:assert/strict";
import { SpeechRecognitionService } from "./SpeechRecognitionService.mjs";

class FakeTarget {
  constructor() { this.events = []; }
  dispatchEvent(event) { this.events.push({ type: event.type, detail: event.detail }); }
}

function makeProvider() {
  const calls = [];
  let onEvent = null;
  return {
    id: "whisper-cpp",
    kind: "offline",
    calls,
    capabilities: { recognition: true, offline: true, final: true },
    isAvailable: () => ({ available: true }),
    async startRecognition(options) {
      calls.push({ type: "start", options });
      onEvent = options.onEvent;
      onEvent("speech.recognition.started", {});
      return { ok: true, state: "listening" };
    },
    async stopRecognition(options) {
      calls.push({ type: "stop", options });
      onEvent("speech.recognition.final", { text: "hello nodevision" });
      onEvent("speech.recognition.finished", {});
      return { ok: true, state: "finished" };
    },
  };
}

const target = new FakeTarget();
const provider = makeProvider();
const finalTexts = [];
const service = new SpeechRecognitionService({
  target,
  providers: [provider],
  settingsProvider: () => ({ providerId: "whisper-cpp", allowBrowserRecognition: false, language: "en" }),
});

const started = await service.startRecognition({ source: "test", onFinalText: (text) => finalTexts.push(text) });
assert.equal(started.provider, "whisper-cpp");
assert.equal(service.isRecognitionActive(), true);

await service.stopRecognition("command");
assert.deepEqual(finalTexts, ["hello nodevision"]);
assert.equal(service.isRecognitionActive(), false);
assert.deepEqual(target.events.map((entry) => entry.type), [
  "speech.recognition.started",
  "speech.recognition.final",
  "speech.recognition.finished",
]);
assert.equal(provider.calls[1].options.finalize, true);

console.log("SpeechRecognitionService tests passed.");

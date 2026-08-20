// Nodevision/ApplicationSystem/public/Speech/providers/LinuxNativeSpeechProvider.test.mjs
// This test validates browser-side polling for server-backed eSpeak native boundary events and source-offset mapping.

import assert from "node:assert/strict";
import { segmentSpeechText } from "../SpeechTextSegments.mjs";
import { createEspeakNativeSpeechProvider, createLinuxNativeSpeechProvider } from "./LinuxNativeSpeechProvider.mjs";

function response(payload, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => payload };
}

const originalFetch = globalThis.fetch;
let statusCalls = 0;
const posted = [];
globalThis.fetch = async (url, options = {}) => {
  const path = String(url);
  if (path === "/api/speech/providers") {
    return response({ ok: true, providers: [
      { id: "espeak-native", available: true, capabilities: { wordBoundary: true } },
      { id: "linux-native", available: false, reason: "no cli" },
    ] });
  }
  if (path === "/api/speech/speak") {
    posted.push(JSON.parse(options.body));
    return response({ ok: true, providerId: "espeak-native", utteranceId: "speech-native-test" });
  }
  if (path.startsWith("/api/speech/status")) {
    statusCalls += 1;
    return response({
      ok: true,
      providerId: "espeak-native",
      state: "finished",
      cursor: 3,
      events: [
        { type: "started", utteranceId: "speech-native-test" },
        { type: "boundary", utteranceId: "speech-native-test", boundaryType: "word", nativeTextPosition: 5, nativeTextLength: 3, audioPositionMs: 200 },
        { type: "finished", utteranceId: "speech-native-test" },
      ],
    });
  }
  throw new Error(`Unexpected fetch ${path}`);
};

const provider = createEspeakNativeSpeechProvider();
assert.equal((await provider.isAvailable()).available, true);
const events = [];
await provider.speak("One two.", {
  utteranceId: "speech-native-test",
  segments: segmentSpeechText("One two."),
  onEvent: (name, detail) => events.push({ name, detail }),
});
await new Promise((resolve) => setTimeout(resolve, 180));

assert.equal(posted[0].providerId, "espeak-native");
assert.equal(statusCalls, 1);
assert.deepEqual(events.map((event) => event.name), ["speech.started", "speech.boundary", "speech.finished"]);
assert.equal(events[1].detail.word, "two");
assert.equal(events[1].detail.charIndex, 4);
assert.equal(events[1].detail.audioPositionMs, 200);
assert.equal((await createLinuxNativeSpeechProvider().isAvailable()).available, false);

globalThis.fetch = originalFetch;
console.log("LinuxNativeSpeechProvider tests passed.");

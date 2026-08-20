// Nodevision/ApplicationSystem/public/Speech/SpeechService.test.mjs
// This test validates utterance IDs, normalized events, sequential speech, cancellation cleanup, stale event isolation, and provider errors.

import assert from "node:assert/strict";
import { SpeechService } from "./SpeechService.mjs";

class FakeTarget {
  constructor() { this.events = []; }
  dispatchEvent(event) { this.events.push({ type: event.type, detail: event.detail }); }
}

function makeProvider(capabilities = {}) {
  const calls = [];
  const provider = {
    id: "fake-native",
    kind: "native",
    calls,
    capabilities: { pause: true, resume: true, rate: true, wordBoundary: true, charIndex: true, ...capabilities },
    async isAvailable() { return { available: true }; },
    async speak(text, options) {
      calls.push({ type: "speak", text, options });
      options.onEvent("speech.started", { elapsedTime: 0 });
      return { ok: true, utteranceId: options.utteranceId };
    },
    async stop() { calls.push({ type: "stop" }); return { ok: true }; },
    async pause() { calls.push({ type: "pause" }); return { ok: true }; },
    async resume() { calls.push({ type: "resume" }); return { ok: true }; },
  };
  return provider;
}

const target = new FakeTarget();
const provider = makeProvider();
const service = new SpeechService({ target, providers: [provider] });

const first = await service.speak("One two three.", {});
provider.calls[0].options.onEvent("speech.boundary", { tokenIndex: 1 });
provider.calls[0].options.onEvent("speech.finished", {});
assert.equal(first.provider, "fake-native");
assert.match(first.utteranceId, /^speech-/);
assert.equal(target.events.find((entry) => entry.type === "speech.boundary").detail.charIndex, 4);
assert.equal(target.events.find((entry) => entry.type === "speech.boundary").detail.word, "two");

const second = await service.speak("Four five.", {});
provider.calls.at(-1).options.onEvent("speech.finished", {});
assert.notEqual(first.utteranceId, second.utteranceId);
assert.equal(target.events.filter((entry) => entry.type === "speech.started").length, 2);

let cleanup = null;
const third = await service.speak("Long speech.", {
  executionContext: { addCleanup(callback) { cleanup = callback; return () => {}; } },
});
const thirdSpeakCall = provider.calls.at(-1);
cleanup();
assert.equal(target.events.at(-1).type, "speech.cancelled");
assert.equal(target.events.at(-1).detail.utteranceId, third.utteranceId);
thirdSpeakCall.options.onEvent("speech.finished", {});
assert.equal(target.events.filter((entry) => entry.detail?.utteranceId === third.utteranceId && entry.type === "speech.finished").length, 0);

const fourth = await service.speak("Error speech.", {});
provider.calls.at(-1).options.onEvent("speech.error", { error: "provider failed" });
assert.equal(target.events.some((entry) => entry.type === "speech.error" && entry.detail.utteranceId === fourth.utteranceId), true);
assert.equal(target.events.some((entry) => entry.type === "speech.cancelled" && entry.detail.reason === "error"), true);

await service.speak("Pause me.", {});
await service.pause();
await service.resume();
assert.equal(provider.calls.some((call) => call.type === "pause"), true);
assert.equal(provider.calls.some((call) => call.type === "resume"), true);
assert.deepEqual(service.setRate(20), { ok: true, rate: 10 });

const capabilityTarget = new FakeTarget();
const speechOnly = makeProvider({ wordBoundary: false });
speechOnly.id = "speech-only";
const boundaryProvider = makeProvider({ wordBoundary: true });
boundaryProvider.id = "boundary-provider";
const capabilityService = new SpeechService({ target: capabilityTarget, providers: [speechOnly, boundaryProvider] });
const capabilityUtterance = await capabilityService.speak("Need boundaries.", { speechRequirements: { wordBoundary: true } });
assert.equal(capabilityUtterance.provider, "boundary-provider");

const throwTarget = new FakeTarget();
const throwProvider = makeProvider();
throwProvider.stop = () => { throw new Error("stop failed"); };
const throwService = new SpeechService({ target: throwTarget, providers: [throwProvider] });
const throwUtterance = await throwService.speak("Stop throws.", {});
await throwService.cancelActive("test-stop-throw");
assert.equal(throwTarget.events.at(-1).type, "speech.cancelled");
assert.equal(throwTarget.events.at(-1).detail.utteranceId, throwUtterance.utteranceId);

console.log("SpeechService tests passed.");

// Nodevision/ApplicationSystem/public/Speech/providers/BrowserSpeechProvider.test.mjs
// This test validates that browser Web Speech is not treated as available when no voices are loaded and that events are relayed when a voice exists.

import assert from "node:assert/strict";
import { createBrowserSpeechProvider } from "./BrowserSpeechProvider.mjs";

const zeroVoices = createBrowserSpeechProvider({
  speechSynthesis: {
    getVoices: () => [],
    addEventListener() {},
    removeEventListener() {},
  },
  SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {},
});

const unavailable = await zeroVoices.isAvailable();
assert.equal(unavailable.available, false);
assert.match(unavailable.reason, /no usable voices/i);

let spoken = null;
const events = [];
function Utterance(text) {
  this.text = text;
}

const usable = createBrowserSpeechProvider({
  speechSynthesis: {
    getVoices: () => [{ name: "Test Voice" }],
    speak(utterance) {
      spoken = utterance.text;
      utterance.onstart({ elapsedTime: 0 });
      utterance.onboundary({ charIndex: 4, charLength: 3, name: "word" });
      utterance.onend({ elapsedTime: 0.1 });
    },
    cancel() {},
  },
  SpeechSynthesisUtterance: Utterance,
});

assert.equal((await usable.isAvailable()).available, true);
await usable.speak("One two.", { utteranceId: "speech-browser-1", onEvent: (name, detail) => events.push({ name, detail }) });
assert.equal(spoken, "One two.");
assert.deepEqual(events.map((entry) => entry.name), ["speech.started", "speech.boundary", "speech.finished"]);
assert.equal(events[1].detail.charIndex, 4);

console.log("BrowserSpeechProvider tests passed.");

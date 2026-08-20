// Nodevision/ApplicationSystem/public/Speech/SpeechEventNormalizer.test.mjs
// This test validates provider-independent speech event payload normalization, utterance identity, boundary provenance, and rate clamping.

import assert from "node:assert/strict";
import { createUtteranceId, normalizeSpeechEvent, normalizeSpeechRate } from "./SpeechEventNormalizer.mjs";
import { segmentSpeechText } from "./SpeechTextSegments.mjs";

const segments = segmentSpeechText("One two three four five.");
const context = { providerId: "test-provider", utteranceId: "speech-test-1", segments, rate: 1.25 };

const nativeChar = normalizeSpeechEvent("speech.boundary", { charIndex: 14, charLength: 4, name: "word" }, context);
assert.equal(nativeChar.provider, "test-provider");
assert.equal(nativeChar.utteranceId, "speech-test-1");
assert.equal(nativeChar.charIndex, 14);
assert.equal(nativeChar.word, "four");
assert.equal(nativeChar.boundaryStatus, "position-known");
assert.equal(nativeChar.positionSource, "provider-char-index");
assert.equal(nativeChar.offsetUnit, "utf16-code-unit");
const nativeDiagnostic = normalizeSpeechEvent("speech.boundary", { charIndex: 14, nativeTextPosition: 15, nativeTextLength: 4, audioPositionMs: 712, positionSource: "espeak-character-1-based" }, context);
assert.equal(nativeDiagnostic.audioPositionMs, 712);
assert.equal(nativeDiagnostic.nativeTextPosition, 15);
assert.equal(nativeDiagnostic.positionSource, "espeak-character-1-based");

const tokenMapped = normalizeSpeechEvent("speech.boundary", { tokenIndex: 2 }, context);
assert.equal(tokenMapped.charIndex, 8);
assert.equal(tokenMapped.word, "three");
assert.equal(tokenMapped.positionSource, "provider-token-index");

const unknown = normalizeSpeechEvent("speech.boundary", { name: "word" }, context);
assert.equal(unknown.charIndex, null);
assert.equal(unknown.boundaryStatus, "position-unknown");

assert.equal(normalizeSpeechRate(-1), 0.1);
assert.equal(normalizeSpeechRate(20), 10);
assert.equal(normalizeSpeechRate("2.5"), 2.5);
assert.match(createUtteranceId(), /^speech-/);

console.log("SpeechEventNormalizer tests passed.");

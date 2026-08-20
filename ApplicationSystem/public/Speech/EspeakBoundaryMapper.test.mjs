// Nodevision/ApplicationSystem/public/Speech/EspeakBoundaryMapper.test.mjs
// This test validates conversion of raw eSpeak word positions into Nodevision UTF-16 source offsets for punctuation, newlines, and Greek text.

import assert from "node:assert/strict";
import { mapEspeakBoundaryEvent } from "./EspeakBoundaryMapper.mjs";
import { segmentSpeechText } from "./SpeechTextSegments.mjs";

function mapped(text, positions) {
  const segments = segmentSpeechText(text);
  return positions.map((nativeTextPosition) => mapEspeakBoundaryEvent({ type: "boundary", boundaryType: "word", nativeTextPosition }, segments));
}

assert.deepEqual(mapped("One two three four five.", [1, 5, 9, 15, 20]).map((event) => [event.word, event.charIndex, event.charLength]), [
  ["One", 0, 3],
  ["two", 4, 3],
  ["three", 8, 5],
  ["four", 14, 4],
  ["five", 19, 4],
]);

assert.deepEqual(mapped("Hello, world. This is Nodevision.", [1, 8, 15, 20, 23]).map((event) => event.charIndex), [0, 7, 14, 19, 22]);
assert.deepEqual(mapped("First line.\nSecond line.", [1, 7, 13, 20]).map((event) => event.charIndex), [0, 6, 12, 19]);

const greek = mapped("Ἐν ἀρχῇ ἦν ὁ λόγος.", [1, 4, 9, 12, 14]);
assert.deepEqual(greek.map((event) => event.word), ["Ἐν", "ἀρχῇ", "ἦν", "ὁ", "λόγος"]);
assert.deepEqual(greek.map((event) => event.charIndex), [0, 3, 8, 11, 13]);
assert.equal(greek[0].positionSource, "espeak-character-1-based");

const unmapped = mapEspeakBoundaryEvent({ type: "boundary", nativeTextPosition: 999 }, segmentSpeechText("One."));
assert.equal(unmapped.charIndex, null);
assert.equal(unmapped.positionSource, "espeak-unmapped");

console.log("EspeakBoundaryMapper tests passed.");

// Nodevision/ApplicationSystem/public/Speech/SpeechTextSegments.test.mjs
// This test validates speech token source offsets for ASCII, punctuation, newlines, and Unicode text using JavaScript UTF-16 code-unit indices.

import assert from "node:assert/strict";
import { segmentSpeechText, tokenAtCharIndex } from "./SpeechTextSegments.mjs";

function positions(text) {
  return segmentSpeechText(text).tokens.map((token) => [token.word, token.charIndex]);
}

assert.deepEqual(positions("One two three four five."), [
  ["One", 0],
  ["two", 4],
  ["three", 8],
  ["four", 14],
  ["five", 19],
]);

assert.deepEqual(positions("Hello, world. This is Nodevision."), [
  ["Hello", 0],
  ["world", 7],
  ["This", 14],
  ["is", 19],
  ["Nodevision", 22],
]);

assert.deepEqual(positions("First line.\nSecond line."), [
  ["First", 0],
  ["line", 6],
  ["Second", 12],
  ["line", 19],
]);

const greek = segmentSpeechText("Ἐν ἀρχῇ ἦν ὁ λόγος.");
assert.deepEqual(greek.tokens.map((token) => token.word), ["Ἐν", "ἀρχῇ", "ἦν", "ὁ", "λόγος"]);
assert.deepEqual(greek.tokens.map((token) => token.charIndex), [0, 3, 8, 11, 13]);
assert.equal(tokenAtCharIndex(greek, 13).word, "λόγος");
assert.equal(greek.offsetUnit, "utf16-code-unit");

console.log("SpeechTextSegments tests passed.");

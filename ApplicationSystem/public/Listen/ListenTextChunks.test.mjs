// Nodevision/ApplicationSystem/public/Listen/ListenTextChunks.test.mjs
// This test validates that rendered page listen text is split into speech-sized chunks with stable source offsets and boundary-friendly endings.

import assert from "node:assert/strict";
import { LISTEN_UTTERANCE_MAX_LENGTH, nextListenSpeechChunk } from "./ListenTextChunks.mjs";

const short = nextListenSpeechChunk("One small page.", 0);
assert.equal(short.start, 0);
assert.equal(short.end, 15);
assert.equal(short.text, "One small page.");

const leadingWhitespace = nextListenSpeechChunk("   Resume here.", 0, 20);
assert.equal(leadingWhitespace.start, 3);
assert.equal(leadingWhitespace.text, "Resume here.");

const longText = "A ".repeat(45000) + "B ".repeat(45000);
const chunk = nextListenSpeechChunk(longText, 0);
assert(chunk.text.length <= LISTEN_UTTERANCE_MAX_LENGTH);
assert(chunk.end < longText.length);
assert.equal(longText.slice(chunk.start, chunk.end), chunk.text);
assert.equal(/\s$/u.test(chunk.text), false);

const noBoundary = nextListenSpeechChunk("x".repeat(LISTEN_UTTERANCE_MAX_LENGTH + 100), 0);
assert.equal(noBoundary.text.length, LISTEN_UTTERANCE_MAX_LENGTH);
assert.equal(noBoundary.end, LISTEN_UTTERANCE_MAX_LENGTH);

console.log("ListenTextChunks tests passed.");

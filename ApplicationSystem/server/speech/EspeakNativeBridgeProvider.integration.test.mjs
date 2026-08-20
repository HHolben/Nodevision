// Nodevision/ApplicationSystem/server/speech/EspeakNativeBridgeProvider.integration.test.mjs
// This optional integration test exercises the real eSpeak NG native bridge when the local developer machine has built it.

import assert from "node:assert/strict";
import { createEspeakNativeBridgeProvider, discoverEspeakBridgeExecutable } from "./EspeakNativeBridgeProvider.mjs";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectUntilTerminal(provider, utteranceId, timeoutMs = 6000) {
  let cursor = 0;
  const events = [];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = provider.status(utteranceId, cursor);
    cursor = Number(status.cursor) || cursor;
    events.push(...(status.events || []));
    if (["finished", "cancelled", "error"].includes(status.state)) return { status, events };
    await wait(80);
  }
  throw new Error("Timed out waiting for native eSpeak bridge terminal event.");
}

function wordEvents(events) {
  return events.filter((event) => event.type === "boundary" && event.boundaryType === "word");
}

const executable = discoverEspeakBridgeExecutable();
if (!executable) {
  console.log("SKIP: eSpeak native bridge is not built.");
  process.exit(0);
}

const provider = createEspeakNativeBridgeProvider({ executable });
const availability = provider.isAvailable();
if (!availability.available) {
  console.log(`SKIP: eSpeak native bridge unavailable: ${availability.reason}`);
  process.exit(0);
}

const text = "One two three four five.";
const utteranceId = `native-integration-${Date.now()}`;
const started = provider.speak({ text, rate: 1, utteranceId });
assert.equal(started.ok, true);
assert.equal(started.provider, "espeak-native");
const result = await collectUntilTerminal(provider, utteranceId);
assert.equal(result.status.state, "finished");
const words = wordEvents(result.events);
assert.equal(words.length, 5);
assert.deepEqual(words.map((event) => event.nativeTextPosition), [1, 5, 9, 15, 20]);
assert(words.every((event) => Number.isFinite(Number(event.audioPositionMs))));
const greekText = "Ἐν ἀρχῇ ἦν ὁ λόγος.";
const greekUtteranceId = "native-integration-greek-" + Date.now();
provider.speak({ text: greekText, rate: 1, utteranceId: greekUtteranceId });
const greekResult = await collectUntilTerminal(provider, greekUtteranceId);
assert.equal(greekResult.status.state, "finished");
const greekWords = wordEvents(greekResult.events);
assert.deepEqual(greekWords.map((event) => event.nativeTextPosition), [1, 4, 9, 12, 14]);
assert.deepEqual(greekWords.map((event) => event.nativeTextLength), [2, 4, 2, 1, 5]);

console.log(JSON.stringify({ ok: true, executable, events: result.events, greekEvents: greekResult.events }, null, 2));

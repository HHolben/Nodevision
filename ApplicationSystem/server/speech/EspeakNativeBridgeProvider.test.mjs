// Nodevision/ApplicationSystem/server/speech/EspeakNativeBridgeProvider.test.mjs
// This test validates the optional eSpeak native bridge provider protocol parsing, fixed arguments, stdin text handling, status cursors, and cancellation.

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { buildBridgeArgs, createEspeakNativeBridgeProvider, parseBridgeEventLine } from "./EspeakNativeBridgeProvider.mjs";

class FakeChild extends EventEmitter {
  constructor(record) {
    super();
    this.record = record;
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.stdin = { end: (text) => { record.stdin = text; } };
  }
  kill(signal) { this.record.killed = signal; }
}

const adversarial = "hello; && | $(bad) `bad`\nἘν ἀρχῇ";
const records = [];
function spawnImpl(executable, args, options) {
  const record = { executable, args, options };
  records.push(record);
  record.child = new FakeChild(record);
  return record.child;
}

function spawnSyncImpl(executable, args, options) {
  records.push({ executable, args, options, probe: true });
  return { status: 0, stdout: "{\"type\":\"probe\",\"ok\":true,\"sampleRate\":22050}\n" };
}

assert.deepEqual(buildBridgeArgs({ utteranceId: "u1", rate: 1 }), ["--utterance-id", "u1", "--rate", "175"]);
assert.deepEqual(parseBridgeEventLine("{\"type\":\"boundary\",\"nativeTextPosition\":1}"), { type: "boundary", nativeTextPosition: 1 });
assert.throws(() => parseBridgeEventLine("{\"type\":\"unknown\"}"), /Unknown/);

const provider = createEspeakNativeBridgeProvider({ executable: "/tmp/nodevision-espeak-bridge", spawnImpl, spawnSyncImpl });
assert.equal(provider.isAvailable().available, true);

const started = provider.speak({ text: adversarial, rate: 1, utteranceId: "speech-native-1" });
assert.equal(started.ok, true);
assert.equal(records[1].options.shell, false);
assert.equal(records[1].args.includes(adversarial), false);
assert.equal(records[1].stdin, adversarial);

records[1].child.stdout.emit("data", "{\"type\":\"started\",\"utteranceId\":\"speech-native-1\"}\n");
records[1].child.stdout.emit("data", "{\"type\":\"boundary\",\"utteranceId\":\"speech-native-1\",\"nativeTextPosition\":1,\"nativeTextLength\":3,\"audioPositionMs\":120}\n");
let status = provider.status("speech-native-1", 0);
assert.equal(status.events.length, 2);
assert.equal(status.events[1].nativeTextPosition, 1);
assert.equal(provider.status("speech-native-1", status.cursor).events.length, 0);

const stopped = provider.stop({ utteranceId: "speech-native-1", reason: "test" });
assert.equal(stopped.state, "cancelled");
assert.equal(records[1].killed, "SIGTERM");
status = provider.status("speech-native-1", 2);
assert.equal(status.events[0].type, "cancelled");

const badProvider = createEspeakNativeBridgeProvider({ executable: "/tmp/nodevision-espeak-bridge", spawnImpl, spawnSyncImpl });
badProvider.speak({ text: "bad", utteranceId: "speech-native-bad" });
records[2].child.stdout.emit("data", "{\"type\":\"not-real\"}\n");
const badStatus = badProvider.status("speech-native-bad", 0);
assert.equal(badStatus.state, "error");
assert.match(badStatus.events.at(-1).error, /Unknown native speech bridge event type/);
assert.equal(records[2].killed, "SIGTERM");

const unavailable = createEspeakNativeBridgeProvider({ executable: null, spawnImpl, spawnSyncImpl });
assert.equal(unavailable.isAvailable().available, false);
assert.throws(() => unavailable.speak({ text: "x", utteranceId: "missing" }), /not built/);

console.log("EspeakNativeBridgeProvider tests passed.");

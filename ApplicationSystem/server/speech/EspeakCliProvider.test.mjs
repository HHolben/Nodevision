// Nodevision/ApplicationSystem/server/speech/EspeakCliProvider.test.mjs
// This test validates eSpeak CLI rate mapping, fixed argument construction, stdin text handling, availability, cancellation, and shell-injection resistance.

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { buildEspeakArgs, createEspeakCliProvider, discoverEspeakExecutable, normalizeEspeakRate } from "./EspeakCliProvider.mjs";

class FakeChild extends EventEmitter {
  constructor(record) {
    super();
    this.record = record;
    this.stderr = new EventEmitter();
    this.stdin = { end: (text) => { this.record.stdin = text; } };
  }
  kill(signal) {
    this.record.killed = signal;
  }
}

const adversarial = "hello; && | $(touch bad) `bad` \"quotes\"\nnext";
const spawnRecords = [];
function spawnImpl(executable, args, options) {
  const record = { executable, args, options };
  spawnRecords.push(record);
  record.child = new FakeChild(record);
  return record.child;
}

assert.equal(discoverEspeakExecutable(""), null);
assert.equal(normalizeEspeakRate(0.5), 88);
assert.equal(normalizeEspeakRate(1), 175);
assert.equal(normalizeEspeakRate(3), 450);
assert.deepEqual(buildEspeakArgs({ rate: 1 }), ["-s", "175", "--stdin"]);

const provider = createEspeakCliProvider({ executable: "/usr/bin/espeak-ng", spawnImpl });
assert.equal(provider.isAvailable().available, true);
const started = provider.speak({ text: adversarial, rate: 1, utteranceId: "speech-native-1" });
assert.equal(started.ok, true);
assert.equal(spawnRecords[0].options.shell, false);
assert.equal(spawnRecords[0].args.includes(adversarial), false);
assert.equal(spawnRecords[0].stdin, adversarial);
spawnRecords[0].child.emit("exit", 0, null);
assert.equal(provider.status("speech-native-1").state, "finished");

provider.speak({ text: "Cancel me", rate: 1, utteranceId: "speech-native-2" });
const stopped = provider.stop({ reason: "test" });
assert.equal(stopped.state, "cancelled");
assert.equal(spawnRecords[1].killed, "SIGTERM");

const missing = createEspeakCliProvider({ envPath: "" });
assert.equal(missing.isAvailable().available, false);
assert.throws(() => missing.speak({ text: "No provider" }), /No eSpeak executable/);

console.log("EspeakCliProvider tests passed.");

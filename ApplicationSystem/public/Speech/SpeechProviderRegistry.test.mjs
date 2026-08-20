// Nodevision/ApplicationSystem/public/Speech/SpeechProviderRegistry.test.mjs
// This test validates speech provider registration, availability reporting, automatic selection, and explicit provider selection.

import assert from "node:assert/strict";
import { SpeechProviderRegistry } from "./SpeechProviderRegistry.mjs";

function provider(id, kind, available, capabilities = {}) {
  return {
    id,
    kind,
    capabilities: { rate: true, ...capabilities },
    async isAvailable() {
      return { available, reason: available ? "" : `${id} unavailable` };
    },
    async speak() {
      return { ok: true };
    },
  };
}

const registry = new SpeechProviderRegistry([
  provider("espeak-native", "native", true, { wordBoundary: true, charIndex: true }),
  provider("linux-native", "native", true, { wordBoundary: false }),
  provider("browser", "browser", true, { wordBoundary: true }),
]);

assert.equal(registry.get("browser").id, "browser");
assert.equal((await registry.select()).provider.id, "espeak-native");
assert.equal((await registry.select({ requirements: { wordBoundary: true } })).provider.id, "espeak-native");
assert.equal((await registry.select({ providerId: "browser" })).provider.id, "browser");
assert.equal((await registry.select({ providerId: "linux-native", requirements: { wordBoundary: true } })).provider, null);
assert.equal((await registry.statuses()).length, 3);

const unavailable = new SpeechProviderRegistry([
  provider("linux-native", "native", false),
  provider("browser", "browser", false),
]);
const selected = await unavailable.select();
assert.equal(selected.provider, null);
assert.match(selected.status.reason, /No usable offline speech provider/);

await assert.rejects(
  async () => new SpeechProviderRegistry([{ id: "bad", isAvailable() {} }]),
  /needs speak/,
);

console.log("SpeechProviderRegistry tests passed.");

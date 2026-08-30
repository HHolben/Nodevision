// Nodevision/ApplicationSystem/public/Speech/SpeechRecognitionProviderRegistry.test.mjs
// This test validates speech-recognition provider selection without allowing implicit online fallback.

import assert from "node:assert/strict";
import { SpeechRecognitionProviderRegistry } from "./SpeechRecognitionProviderRegistry.mjs";

function provider(id, { available = true, offline = true } = {}) {
  return {
    id,
    kind: offline ? "offline" : "browser",
    capabilities: { recognition: true, offline },
    isAvailable: () => ({ available, reason: available ? "" : `${id} unavailable` }),
    startRecognition: () => ({ ok: true }),
  };
}

const offlineUnavailable = provider("whisper-cpp", { available: false, offline: true });
const browserAvailable = provider("browser-recognition", { available: true, offline: false });
const registry = new SpeechRecognitionProviderRegistry([offlineUnavailable, browserAvailable]);

let selected = await registry.select({ providerId: "automatic", requirements: { recognition: true } });
assert.equal(selected.provider, null);
assert.match(selected.status.reason, /offline speech-recognition/);

selected = await registry.select({ providerId: "automatic", allowOnline: true, requirements: { recognition: true } });
assert.equal(selected.provider.id, "browser-recognition");

selected = await registry.select({ providerId: "browser-recognition", requirements: { recognition: true } });
assert.equal(selected.provider, null);
assert.match(selected.status.reason, /online opt-in/);

selected = await registry.select({ providerId: "browser-recognition", allowOnline: true, requirements: { recognition: true } });
assert.equal(selected.provider.id, "browser-recognition");

selected = await registry.select({ providerId: "missing", requirements: { recognition: true } });
assert.equal(selected.provider, null);
assert.match(selected.status.reason, /Unknown recognition provider/);

console.log("SpeechRecognitionProviderRegistry tests passed.");

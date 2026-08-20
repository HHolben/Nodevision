// Nodevision/ApplicationSystem/server/routes/speechRoutes.test.mjs
// This test validates the authenticated speech backend route boundary with fake providers and without exposing generic process execution.

import assert from "node:assert/strict";
import { registerSpeechRoutes } from "./speechRoutes.mjs";

class FakeApp {
  constructor() { this.routes = new Map(); }
  get(path, handler) { this.routes.set(`GET ${path}`, handler); }
  post(path, handler) { this.routes.set(`POST ${path}`, handler); }
  route(method, path) { return this.routes.get(`${method} ${path}`); }
}

function response() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

const calls = [];
const nativeProvider = {
  id: "espeak-native",
  label: "Fake Native Boundary",
  capabilities: { rate: true, wordBoundary: true, offline: true },
  isAvailable: () => ({ available: true }),
  speak(payload) { calls.push({ type: "native-speak", payload }); return { ok: true, provider: this.id, utteranceId: payload.utteranceId }; },
  stop(payload) { calls.push({ type: "native-stop", payload }); return { ok: true, state: "cancelled" }; },
  status: (utteranceId, cursor) => ({ state: "finished", utteranceId, cursor: Number(cursor) || 0, events: [] }),
};

const cliProvider = { ...nativeProvider, id: "linux-native", label: "Fake CLI", capabilities: { rate: true, wordBoundary: false } };
const app = new FakeApp();
registerSpeechRoutes(app, {}, { providers: [nativeProvider, cliProvider] });

let res = response();
await app.route("GET", "/api/speech/providers")({ identity: null }, res);
assert.equal(res.statusCode, 401);

res = response();
await app.route("GET", "/api/speech/providers")({ identity: { user: "test" } }, res);
assert.deepEqual(res.payload.providers.map((entry) => entry.id), ["espeak-native", "linux-native"]);

const text = "hello; && | $(bad)";
res = response();
await app.route("POST", "/api/speech/speak")({ identity: { user: "test" }, body: { providerId: "espeak-native", text, rate: 1, utteranceId: "u1" } }, res);
assert.equal(res.payload.ok, true);
assert.equal(res.payload.providerId, "espeak-native");
assert.equal(calls[0].payload.text, text);

res = response();
app.route("GET", "/api/speech/status")({ identity: { user: "test" }, query: { providerId: "espeak-native", utteranceId: "u1", cursor: "2" } }, res);
assert.equal(res.payload.state, "finished");
assert.equal(res.payload.cursor, 2);

console.log("speechRoutes tests passed.");

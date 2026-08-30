// Nodevision/ApplicationSystem/server/routes/speechRecognitionRoutes.test.mjs
// This test validates the authenticated local speech-recognition route boundary with a fake provider.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerSpeechRecognitionRoutes } from "./speechRecognitionRoutes.mjs";

class FakeApp {
  constructor() { this.routes = new Map(); }
  get(routePath, handler) { this.routes.set(`GET ${routePath}`, handler); }
  post(routePath, handler) { this.routes.set(`POST ${routePath}`, handler); }
  route(method, routePath) { return this.routes.get(`${method} ${routePath}`); }
}

function response() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function wavBase64() {
  return Buffer.from("RIFF0000WAVE", "ascii").toString("base64");
}

const calls = [];
const provider = {
  id: "whisper-cpp",
  label: "Fake Whisper",
  capabilities: { recognition: true, offline: true },
  isAvailable: () => ({ available: true }),
  start(payload) {
    calls.push({ type: "start", payload });
    return { ok: true, provider: this.id, utteranceId: payload.utteranceId, state: "processing" };
  },
  stop(payload) {
    calls.push({ type: "stop", payload });
    return { ok: true, state: "cancelled" };
  },
  status: (utteranceId, cursor) => ({ state: "finished", utteranceId, cursor: Number(cursor) || 0, events: [{ type: "final", text: "hello" }] }),
};

const root = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-recognition-routes-"));
const ctx = {
  userSettingsDir: path.join(root, "UserSettings"),
  userDataDir: path.join(root, "UserData"),
};
const app = new FakeApp();
registerSpeechRecognitionRoutes(app, ctx, { providers: [provider] });

let res = response();
await app.route("GET", "/api/speech/recognition/providers")({ identity: null }, res);
assert.equal(res.statusCode, 401);

res = response();
await app.route("GET", "/api/speech/recognition/providers")({ identity: { user: "test" } }, res);
assert.deepEqual(res.payload.providers.map((entry) => entry.id), ["whisper-cpp"]);

res = response();
await app.route("POST", "/api/speech/recognition/start")({ identity: { user: "test" }, body: { providerId: "whisper-cpp", utteranceId: "d1", audioBase64: wavBase64(), language: "en" } }, res);
assert.equal(res.payload.ok, true);
assert.equal(Buffer.isBuffer(calls[0].payload.audioBuffer), true);

res = response();
await app.route("POST", "/api/speech/recognition/start")({ identity: { user: "test" }, body: { audioBase64: Buffer.from("bad").toString("base64") } }, res);
assert.equal(res.statusCode, 400);

res = response();
app.route("GET", "/api/speech/recognition/status")({ identity: { user: "test" }, query: { providerId: "whisper-cpp", utteranceId: "d1", cursor: "1" } }, res);
assert.equal(res.payload.state, "finished");
assert.equal(res.payload.events[0].text, "hello");

res = response();
await app.route("POST", "/api/speech/recognition/settings")({ identity: { user: "test" }, body: { providerId: "automatic", threads: 3 } }, res);
assert.equal(res.payload.settings.providerId, "automatic");
assert.equal(res.payload.settings.threads, 3);

await fs.rm(root, { recursive: true, force: true });
console.log("speechRecognitionRoutes tests passed.");

// Nodevision/ApplicationSystem/server/speech/WhisperCppProvider.test.mjs
// This test validates whisper.cpp CLI argument construction and transcript parsing without invoking a real model.

import assert from "node:assert/strict";
import { buildWhisperCliArgs, parseWhisperTranscript } from "./WhisperCppProvider.mjs";
import { defaultWhisperModelPath, resolveWhisperModelPath, sanitizeSpeechRecognitionSettings } from "./WhisperCppConfig.mjs";

assert.deepEqual(
  buildWhisperCliArgs({ modelPath: "/models/base.bin", audioPath: "/tmp/audio.wav", language: "en-US", threads: 2.8 }),
  ["--model", "/models/base.bin", "--file", "/tmp/audio.wav", "--language", "en", "--no-timestamps", "--no-prints", "--threads", "2"],
);

assert.equal(parseWhisperTranscript("[00:00:00.000 --> 00:00:01.000] Hello world\\nmain: done"), "Hello world");

const settings = sanitizeSpeechRecognitionSettings({
  providerId: "browser-recognition",
  threads: 100,
  timeoutMs: 1,
  allowBrowserRecognition: true,
});
assert.equal(settings.threads, 32);
assert.equal(settings.timeoutMs, 5000);
assert.equal(settings.allowBrowserRecognition, true);
assert.equal(defaultWhisperModelPath({ userDataDir: "/tmp/nodevision-data" }), "/tmp/nodevision-data/Speech/Models/ggml-base.en.bin");
assert.equal(resolveWhisperModelPath({ userDataDir: "/tmp/nodevision-data" }, {}), "/tmp/nodevision-data/Speech/Models/ggml-base.en.bin");

console.log("WhisperCppProvider tests passed.");

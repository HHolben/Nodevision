// Nodevision/ApplicationSystem/server/speech/WhisperCppProvider.mjs
// This module runs local whisper.cpp transcription jobs from transient WAV files without exposing shell execution.

import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  loadSpeechRecognitionSettings,
  resolveWhisperExecutable,
  resolveWhisperModelPath,
} from "./WhisperCppConfig.mjs";

const DEFAULT_STATUS = Object.freeze({ state: "idle", reason: "No active recognition.", events: [], cursor: 0 });
const MAX_STDOUT_BYTES = 2 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;

async function canReadFile(filePath = "") {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function canRunExecutable(filePath = "") {
  try {
    await fs.access(filePath, fsSync.constants.X_OK);
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function whisperLanguage(value = "en") {
  const clean = String(value || "en").trim().toLowerCase();
  if (clean === "auto") return "auto";
  return clean.split(/[-_]/)[0] || "en";
}

function statusEvents(record, cursor = 0) {
  const start = Math.max(0, Number(cursor) || 0);
  return { events: record.events.slice(start), cursor: record.events.length };
}

export function buildWhisperCliArgs({ modelPath, audioPath, language = "en", threads = 4 } = {}) {
  const args = ["--model", String(modelPath), "--file", String(audioPath), "--language", whisperLanguage(language), "--no-timestamps", "--no-prints"];
  const threadCount = Math.max(1, Math.min(32, Math.floor(Number(threads) || 4)));
  args.push("--threads", String(threadCount));
  return args;
}

export function parseWhisperTranscript(stdout = "") {
  return String(stdout || "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\[[^\]]+\]\s*/, "").trim())
    .filter((line) => line && !/^(whisper_|system_info:|main:)/i.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createWhisperCppProvider(options = {}) {
  const ctx = options.ctx || options;
  const spawnImpl = options.spawnImpl || spawn;
  const loadSettings = options.loadSettings || (() => loadSpeechRecognitionSettings(ctx));
  const records = new Map();
  let active = null;

  function addEvent(record, event) {
    record.events.push({ utteranceId: record.utteranceId, provider: "whisper-cpp", ...event });
    if (["finished", "cancelled", "error"].includes(event.type)) record.state = event.type;
    else if (event.type === "processing") record.state = "processing";
  }

  async function cleanup(record) {
    if (record.timeout) clearTimeout(record.timeout);
    record.child = null;
    if (record.tempDir) await fs.rm(record.tempDir, { recursive: true, force: true }).catch(() => {});
  }

  async function resolveRuntime() {
    const settings = await loadSettings();
    const executable = resolveWhisperExecutable(settings);
    const modelPath = resolveWhisperModelPath(ctx, settings);
    if (!await canRunExecutable(executable)) throw new Error("whisper.cpp executable is not available. Install whisper.cpp or set a whisperExecutable path.");
    if (!await canReadFile(modelPath)) throw new Error("Whisper model file is not available. Add a local model in Dictation Settings.");
    return { settings, executable, modelPath };
  }

  return {
    id: "whisper-cpp",
    label: "whisper.cpp",
    kind: "offline",
    capabilities: { recognition: true, partial: false, final: true, cancel: true, offline: true },

    async isAvailable() {
      try {
        await resolveRuntime();
        return { available: true, reason: "" };
      } catch (err) {
        return { available: false, reason: err?.message || "whisper.cpp is not available." };
      }
    },

    async start({ audioBuffer, utteranceId = "", language = "" } = {}) {
      if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) throw new Error("Recognition audio is required.");
      if (active?.child) this.stop({ utteranceId: active.utteranceId, reason: "superseded" });
      const { settings, executable, modelPath } = await resolveRuntime();
      const id = String(utteranceId || `dictation-${Date.now().toString(36)}`);
      const record = { utteranceId: id, state: "processing", events: [], child: null, tempDir: "" };
      records.set(id, record);
      active = record;
      addEvent(record, { type: "started" });
      addEvent(record, { type: "processing" });

      const tempRoot = ctx.cacheDir || os.tmpdir();
      await fs.mkdir(tempRoot, { recursive: true });
      record.tempDir = await fs.mkdtemp(path.join(tempRoot, "nodevision-whisper-"));
      const audioPath = path.join(record.tempDir, "dictation.wav");
      await fs.writeFile(audioPath, audioBuffer);

      const stdout = [];
      const stderr = [];
      const args = buildWhisperCliArgs({ modelPath, audioPath, language: language || settings.language, threads: settings.threads });
      const child = spawnImpl(executable, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
      record.child = child;
      record.timeout = setTimeout(() => {
        if (record.child) {
          addEvent(record, { type: "error", error: "whisper.cpp transcription timed out." });
          record.child.kill?.("SIGTERM");
        }
      }, settings.timeoutMs).unref?.();

      child.stdout?.on?.("data", (chunk) => {
        if (stdout.join("").length < MAX_STDOUT_BYTES) stdout.push(String(chunk));
      });
      child.stderr?.on?.("data", (chunk) => {
        if (stderr.join("").length < MAX_STDERR_BYTES) stderr.push(String(chunk));
      });
      child.on?.("error", (err) => {
        if (!["finished", "cancelled", "error"].includes(record.state)) addEvent(record, { type: "error", error: err?.message || "whisper.cpp failed to start." });
        if (active === record) active = null;
        cleanup(record);
      });
      child.on?.("exit", (code, signal) => {
        if (["finished", "cancelled", "error"].includes(record.state)) {
          if (active === record) active = null;
          cleanup(record);
          return;
        }
        if (signal) addEvent(record, { type: "cancelled", reason: signal });
        else if (code === 0) {
          const text = parseWhisperTranscript(stdout.join(""));
          if (text) addEvent(record, { type: "final", text });
          addEvent(record, { type: "finished" });
        } else {
          addEvent(record, { type: "error", error: stderr.join("").trim() || `whisper.cpp exited with ${code}.` });
        }
        if (active === record) active = null;
        cleanup(record);
      });
      return { ok: true, provider: this.id, utteranceId: id, state: "processing", capabilities: this.capabilities };
    },

    stop({ utteranceId = "", reason = "command" } = {}) {
      const record = active?.utteranceId === utteranceId ? active : records.get(String(utteranceId || ""));
      if (!record?.child || ["finished", "cancelled", "error"].includes(record.state)) return { ok: true, state: "idle" };
      addEvent(record, { type: "cancelled", reason });
      record.child.kill?.("SIGTERM");
      if (active === record) active = null;
      cleanup(record);
      return { ok: true, state: "cancelled", utteranceId: record.utteranceId, reason };
    },

    status(utteranceId = "", cursor = 0) {
      const record = records.get(String(utteranceId || ""));
      if (!record) return { ...DEFAULT_STATUS };
      const lastError = [...record.events].reverse().find((event) => event.type === "error");
      return { ok: true, state: record.state, utteranceId: record.utteranceId, error: lastError?.error || null, ...statusEvents(record, cursor) };
    },
  };
}

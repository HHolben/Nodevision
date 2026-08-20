// Nodevision/ApplicationSystem/server/speech/EspeakNativeBridgeProvider.mjs
// This module manages the optional eSpeak NG companion bridge process and converts its JSONL output into server-side speech events.

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { normalizeEspeakRate } from "./EspeakCliProvider.mjs";

const BRIDGE_RELATIVE = path.join("native", "speech", "build", "nodevision-espeak-bridge");
const DEFAULT_STATUS = Object.freeze({ state: "idle", reason: "No active utterance.", events: [], cursor: 0 });

export function discoverEspeakBridgeExecutable(ctx = {}) {
  const candidates = [
    ctx.bridgePath,
    ctx.applicationSystemRoot ? path.join(ctx.applicationSystemRoot, BRIDGE_RELATIVE) : null,
    path.resolve(process.cwd(), "ApplicationSystem", BRIDGE_RELATIVE),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Try the next fixed Nodevision-owned bridge location.
    }
  }
  return null;
}

export function buildBridgeArgs({ utteranceId = "", rate = 1, voice = "", probe = false } = {}) {
  const args = ["--utterance-id", String(utteranceId || "speech-native"), "--rate", String(normalizeEspeakRate(rate))];
  if (voice) args.push("--voice", String(voice));
  if (probe) args.push("--probe");
  return args;
}

export function parseBridgeEventLine(line = "") {
  if (String(line).length > 16384) throw new Error("Native speech bridge event frame is too large.");
  const parsed = JSON.parse(String(line));
  const allowed = {};
  for (const key of ["type", "utteranceId", "boundaryType", "nativeTextPosition", "nativeTextLength", "audioPositionMs", "nativeUniqueIdentifier", "nativeWordNumber", "sampleRate", "ok", "error"]) {
    if (parsed[key] !== undefined) allowed[key] = parsed[key];
  }
  if (!/^(started|boundary|finished|cancelled|error|probe)$/.test(String(allowed.type || ""))) throw new Error("Unknown native speech bridge event type.");
  return allowed;
}

function eventSlice(record, cursor = 0) {
  const start = Math.max(0, Number(cursor) || 0);
  return { events: record.events.slice(start), cursor: record.events.length };
}

export function createEspeakNativeBridgeProvider(options = {}) {
  const executable = Object.prototype.hasOwnProperty.call(options, "executable")
    ? options.executable
    : discoverEspeakBridgeExecutable(options);
  const spawnImpl = options.spawnImpl || spawn;
  const spawnSyncImpl = options.spawnSyncImpl || spawnSync;
  const records = new Map();
  let active = null;

  function newRecord(utteranceId) {
    const record = { utteranceId, state: "speaking", events: [], child: null };
    records.set(utteranceId, record);
    return record;
  }

  function addEvent(record, event) {
    record.events.push({ utteranceId: record.utteranceId, provider: "espeak-native", ...event });
    if (["finished", "cancelled", "error"].includes(event.type)) record.state = event.type;
  }

  return {
    id: "espeak-native",
    label: "eSpeak NG Native",
    capabilities: { speech: true, cancel: true, pause: false, resume: false, rate: true, wordBoundary: true, charIndex: true, audioPosition: true, offline: true },
    isAvailable() {
      if (!executable) return { available: false, reason: "Nodevision eSpeak native bridge is not built." };
      const probe = spawnSyncImpl(executable, buildBridgeArgs({ probe: true }), { encoding: "utf8", timeout: 3000, shell: false });
      if (probe.error) return { available: false, reason: probe.error.message };
      if (probe.status !== 0) return { available: false, reason: "eSpeak native bridge probe failed." };
      try {
        const event = parseBridgeEventLine(String(probe.stdout || "").trim().split(/\r?\n/).find(Boolean) || "");
        return { available: event.type === "probe" && event.ok === true, reason: event.ok === true ? "" : "eSpeak native bridge did not initialize." };
      } catch (err) {
        return { available: false, reason: err?.message || "Invalid eSpeak native bridge probe output." };
      }
    },
    speak({ text = "", rate = 1, utteranceId, voice = "" }) {
      if (!executable) throw new Error("Nodevision eSpeak native bridge is not built.");
      if (active?.child) this.stop({ utteranceId: active.utteranceId, reason: "superseded" });
      const record = newRecord(String(utteranceId || ""));
      const child = spawnImpl(executable, buildBridgeArgs({ utteranceId, rate, voice }), { shell: false, stdio: ["pipe", "pipe", "pipe"] });
      record.child = child;
      active = record;
      let buffer = "";
      child.stdout?.on?.("data", (chunk) => {
        buffer += String(chunk);
        if (buffer.length > 16384) {
          addEvent(record, { type: "error", error: "Native bridge output frame is too large." });
          child.kill?.("SIGTERM");
          return;
        }
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines.filter(Boolean)) {
          try {
            addEvent(record, parseBridgeEventLine(line));
          } catch (err) {
            addEvent(record, { type: "error", error: err?.message || "Invalid native bridge event." });
            child.kill?.("SIGTERM");
            break;
          }
        }
      });
      child.on?.("error", (err) => addEvent(record, { type: "error", error: err?.message || "Native bridge failed." }));
      child.on?.("exit", (code, signal) => {
        if (record.state === "speaking") addEvent(record, code === 0 ? { type: "finished" } : { type: signal ? "cancelled" : "error", error: `Native bridge exited with ${code}.` });
        if (active === record) active = null;
      });
      child.stdin?.end?.(String(text ?? ""));
      return { ok: true, provider: this.id, utteranceId: record.utteranceId, state: "speaking", capabilities: this.capabilities };
    },
    stop({ utteranceId = "", reason = "command" } = {}) {
      const record = active?.utteranceId === utteranceId ? active : records.get(String(utteranceId || ""));
      if (!record?.child || record.state !== "speaking") return { ok: true, state: "idle" };
      addEvent(record, { type: "cancelled", reason });
      record.child.kill?.("SIGTERM");
      if (active === record) active = null;
      return { ok: true, state: "cancelled", utteranceId: record.utteranceId, reason };
    },
    status(utteranceId = "", cursor = 0) {
      const record = records.get(String(utteranceId || ""));
      if (!record) return { ...DEFAULT_STATUS };
      return { ok: record.state !== "error", state: record.state, utteranceId: record.utteranceId, ...eventSlice(record, cursor) };
    },
  };
}

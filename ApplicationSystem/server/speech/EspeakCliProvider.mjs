// Nodevision/ApplicationSystem/server/speech/EspeakCliProvider.mjs
// This module implements a narrow Linux-native eSpeak CLI provider that speaks text from stdin without exposing shell execution to Sessions.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const EXECUTABLES = Object.freeze(["espeak-ng", "espeak"]);
const DEFAULT_STATUS = Object.freeze({ state: "idle", reason: "No active utterance.", events: [], cursor: 0 });

function executableInPath(name, envPath = process.env.PATH || "") {
  for (const dir of envPath.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Continue scanning fixed PATH entries.
    }
  }
  return null;
}

export function discoverEspeakExecutable(envPath = process.env.PATH || "") {
  for (const name of EXECUTABLES) {
    const found = executableInPath(name, envPath);
    if (found) return found;
  }
  return null;
}

export function normalizeEspeakRate(rate) {
  const value = Number(rate);
  const normalized = Number.isFinite(value) ? Math.max(0.1, Math.min(10, value)) : 1;
  return Math.max(80, Math.min(450, Math.round(175 * normalized)));
}

export function buildEspeakArgs(options = {}) {
  return ["-s", String(normalizeEspeakRate(options.rate)), "--stdin"];
}

export function createEspeakCliProvider(options = {}) {
  const executable = options.executable || discoverEspeakExecutable(options.envPath);
  const spawnImpl = options.spawnImpl || spawn;
  let active = null;
  let lastStatus = DEFAULT_STATUS;
  let events = [];

  function setTerminal(state, fields = {}) {
    lastStatus = { ok: state !== "error", state, ...fields, finishedAt: new Date().toISOString() };
    events.push({ type: state, utteranceId: fields.utteranceId, provider: "linux-native", reason: fields.reason || null, error: fields.error || null });
    active = null;
  }

  return {
    id: "linux-native",
    label: "eSpeak NG/eSpeak CLI",
    capabilities: { pause: false, resume: false, rate: true, wordBoundary: false, charIndex: false, offline: true },
    isAvailable() {
      return { available: Boolean(executable), reason: executable ? "" : "Neither espeak-ng nor espeak is installed on PATH." };
    },
    speak({ text = "", rate = 1, utteranceId }) {
      if (!executable) throw new Error("No eSpeak executable is available.");
      if (active?.child) this.stop({ reason: "superseded" });
      const stderr = [];
      events = [{ type: "started", utteranceId, provider: "linux-native" }];
      const child = spawnImpl(executable, buildEspeakArgs({ rate }), { shell: false, stdio: ["pipe", "ignore", "pipe"] });
      active = { child, utteranceId, cancelling: false, startedAt: new Date().toISOString() };
      lastStatus = { ok: true, state: "speaking", utteranceId, startedAt: active.startedAt };
      child.stderr?.on?.("data", (chunk) => {
        if (stderr.join("").length < 4096) stderr.push(String(chunk));
      });
      child.on?.("error", (err) => setTerminal("error", { utteranceId, error: err?.message || "Provider failed to start." }));
      child.on?.("exit", (code, signal) => {
        if (active?.child !== child) return;
        if (lastStatus.state === "cancelled" && lastStatus.utteranceId === utteranceId) { active = null; return; }
        if (active.cancelling || signal) return setTerminal("cancelled", { utteranceId, reason: signal || "cancelled" });
        if (code === 0) return setTerminal("finished", { utteranceId });
        return setTerminal("error", { utteranceId, error: stderr.join("").trim() || `eSpeak exited with ${code}.` });
      });
      child.stdin?.end?.(String(text ?? ""));
      return { ok: true, utteranceId, provider: "linux-native", state: "speaking", capabilities: this.capabilities };
    },
    stop({ reason = "command" } = {}) {
      if (!active?.child) return { ok: true, state: "idle" };
      active.cancelling = true;
      const child = active.child;
      child.kill?.("SIGTERM");
      setTimeout(() => {
        if (active?.child === child) child.kill?.("SIGKILL");
      }, 1500).unref?.();
      lastStatus = { ok: true, state: "cancelled", utteranceId: active.utteranceId, reason };
      events.push({ type: "cancelled", utteranceId: active.utteranceId, provider: "linux-native", reason, error: null });
      return lastStatus;
    },
    status(utteranceId = "", cursor = 0) {
      const start = Math.max(0, Number(cursor) || 0);
      const eventPayload = { events: events.slice(start), cursor: events.length };
      if (active?.utteranceId === utteranceId) return { ...lastStatus, ...eventPayload };
      if (lastStatus.utteranceId === utteranceId) return { ...lastStatus, ...eventPayload };
      return { ...DEFAULT_STATUS };
    },
  };
}

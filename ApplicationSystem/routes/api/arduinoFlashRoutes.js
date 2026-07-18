// Nodevision/ApplicationSystem/routes/api/arduinoFlashRoutes.js
// Arduino Flash routes keep board flashing, CLI discovery, and serial monitor IO on the server side.
// The browser panel only calls these APIs; it never reaches directly for local serial devices or shell commands.

import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { EventEmitter } from "node:events";
import { createServerContext } from "../../shared/serverContext.mjs";
import { isWithin, normalizeClientPath } from "./fileSaveRoutes/paths.js";
import {
  isSerialDependencyUnavailable,
  loadSerialDependencies,
  serialUnavailablePayload,
} from "./serialDependencies.mjs";

const execFileAsync = promisify(execFile);
const BASE_CONTEXT = createServerContext();
const CLI_TIMEOUT_MS = 15_000;
const JOB_RETENTION_MS = 10 * 60 * 1000;
const MAX_SERIAL_BUFFER_LINES = 2000;

function arduinoCliCommand(ctx) {
  return process.env.ARDUINO_CLI || "arduino-cli";
}

function normalizeNotebookRelativePath(value) {
  let cleaned = normalizeClientPath(value);
  if (cleaned.toLowerCase().startsWith("notebook/")) cleaned = cleaned.slice("Notebook/".length);
  return cleaned;
}

async function resolveNotebookIno(ctx, filePath) {
  const relativePath = normalizeNotebookRelativePath(filePath);
  if (!relativePath) throw new Error("No .ino file path was provided.");
  if (!relativePath.toLowerCase().endsWith(".ino")) throw new Error("Only .ino files can be flashed.");
  const absolutePath = path.resolve(ctx.notebookDir, relativePath);
  if (!isWithin(ctx.notebookDir, absolutePath)) throw new Error("File must be inside the Notebook.");
  const stat = await fs.stat(absolutePath).catch(() => null);
  if (!stat?.isFile()) throw new Error("Sketch file was not found.");
  return { relativePath, absolutePath, sketchPath: absolutePath };
}

async function runArduinoCli(ctx, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(arduinoCliCommand(ctx), args, {
      timeout: options.timeout || CLI_TIMEOUT_MS,
      maxBuffer: options.maxBuffer || 5 * 1024 * 1024,
      cwd: ctx.notebookDir,
    });
    return { ok: true, stdout: String(stdout || ""), stderr: String(stderr || "") };
  } catch (err) {
    if (err?.code === "ENOENT") {
      const missing = new Error("arduino-cli is not installed or is not on PATH.");
      missing.code = "ARDUINO_CLI_MISSING";
      throw missing;
    }
    throw err;
  }
}

function parseJsonMaybe(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

function normalizePortRecord(port = {}) {
  const address = port.address || port.port || port.path || "";
  const boards = Array.isArray(port.boards) ? port.boards : [];
  const board = boards[0] || {};
  return {
    port: address,
    protocol: port.protocol || "",
    label: [board.name, board.fqbn ? `(${board.fqbn})` : "", address].filter(Boolean).join(" ") || address,
    fqbn: board.fqbn || "",
    boardName: board.name || "",
    raw: port,
  };
}

function parseBoardListText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const fqbnMatch = line.match(/\s([A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+)(?:\s|$)/);
      const portMatch = line.match(/^(\/\S+|COM\d+|\w+:\/\/\S+)/i);
      const fqbn = fqbnMatch?.[1] || "";
      const port = portMatch?.[1] || "";
      return { port, fqbn, boardName: fqbn ? line.slice(0, line.indexOf(fqbn)).trim() : "", label: line, raw: line };
    })
    .filter((item) => item.port || item.fqbn || item.label);
}

function parseBoardListAllText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s{2,}([A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+)$/);
      return match
        ? { name: match[1].trim(), fqbn: match[2].trim(), label: `${match[1].trim()} (${match[2].trim()})` }
        : { name: line, fqbn: "", label: line };
    });
}

function parseLibrariesText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s{2,}/);
      return { name: parts[0] || line, version: parts[1] || "", location: parts.at(-1) || "", raw: line };
    });
}

function validateFqbn(fqbn) {
  const clean = String(fqbn || "").trim();
  if (!/^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(clean)) {
    throw new Error("Select a valid board FQBN.");
  }
  return clean;
}

async function listSerialPorts() {
  const { SerialPort } = await loadSerialDependencies();
  return (await SerialPort.list()).map((p) => ({
    port: p.path,
    label: [p.path, p.manufacturer, p.friendlyName].filter(Boolean).join(" - "),
    manufacturer: p.manufacturer || "",
    serialNumber: p.serialNumber || "",
    vendorId: p.vendorId || "",
    productId: p.productId || "",
    raw: p,
  })).filter((p) => p.port);
}

async function validatePort(port) {
  const clean = String(port || "").trim();
  if (!clean) throw new Error("Select a serial port.");
  const ports = await listSerialPorts();
  if (!ports.some((p) => p.port === clean)) throw new Error(`Serial port is not available: ${clean}`);
  return clean;
}

function createJobStore(ctx) {
  const jobs = new Map();

  function cleanupOldJobs() {
    const cutoff = Date.now() - JOB_RETENTION_MS;
    for (const [id, job] of jobs) {
      if (job.createdAt < cutoff && job.status !== "running") jobs.delete(id);
    }
  }

  function createJob({ kind, args }) {
    cleanupOldJobs();
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const job = {
      id,
      kind,
      args,
      status: "running",
      createdAt: Date.now(),
      exitCode: null,
      error: "",
      lines: [],
      events: new EventEmitter(),
    };
    jobs.set(id, job);

    const child = spawn(arduinoCliCommand(ctx), args, { cwd: ctx.notebookDir });
    job.child = child;

    const emit = (type, text = "") => {
      const entry = { type, text: String(text || ""), at: Date.now() };
      job.lines.push(entry);
      if (job.lines.length > 1000) job.lines.shift();
      job.events.emit("event", entry);
    };

    child.stdout.on("data", (chunk) => emit("stdout", chunk));
    child.stderr.on("data", (chunk) => emit("stderr", chunk));
    child.on("error", (err) => {
      job.status = "error";
      job.error = err?.code === "ENOENT"
        ? "arduino-cli is not installed or is not on PATH."
        : (err?.message || "Arduino CLI process failed.");
      emit("error", job.error);
      job.events.emit("done", job);
    });
    child.on("close", (code) => {
      job.exitCode = code;
      job.status = code === 0 ? "completed" : "failed";
      emit("status", `${kind} ${job.status}${code === null ? "" : ` (exit ${code})`}`);
      job.events.emit("done", job);
    });
    return job;
  }

  return { jobs, createJob };
}

function createSerialStore() {
  const connections = new Map();

  function get(port) {
    return connections.get(port);
  }

  async function connect({ port, baudRate }) {
    const { SerialPort, ReadlineParser } = await loadSerialDependencies();
    const cleanBaud = Number(baudRate);
    if (!Number.isInteger(cleanBaud) || cleanBaud < 300 || cleanBaud > 2000000) {
      throw new Error("Select a valid baud rate.");
    }

    const existing = connections.get(port);
    if (existing?.serial?.isOpen) return existing;

    const state = {
      port,
      baudRate: cleanBaud,
      lines: [],
      events: new EventEmitter(),
      serial: new SerialPort({ path: port, baudRate: cleanBaud, autoOpen: false }),
    };

    const parser = state.serial.pipe(new ReadlineParser({ delimiter: "\n" }));
    parser.on("data", (line) => {
      const text = String(line || "").replace(/\r?\n$/, "");
      const entry = { type: "data", text, at: Date.now() };
      state.lines.push(entry);
      if (state.lines.length > MAX_SERIAL_BUFFER_LINES) state.lines.shift();
      state.events.emit("event", entry);
    });
    state.serial.on("error", (err) => {
      state.events.emit("event", { type: "error", text: err?.message || "Serial connection failed.", at: Date.now() });
    });
    state.serial.on("close", () => {
      state.events.emit("event", { type: "status", text: "Serial disconnected.", at: Date.now() });
      connections.delete(port);
    });

    await new Promise((resolve, reject) => {
      state.serial.open((err) => err ? reject(err) : resolve());
    });
    connections.set(port, state);
    state.events.emit("event", { type: "status", text: `Serial connected at ${cleanBaud} baud.`, at: Date.now() });
    return state;
  }

  async function disconnect(port) {
    const state = connections.get(port);
    if (!state) return false;
    await new Promise((resolve) => state.serial.close(() => resolve()));
    connections.delete(port);
    return true;
  }

  return { get, connect, disconnect };
}

export default function createArduinoFlashRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  console.log("✅ Arduino Flash routes mounted at /api/arduino-flash");
  const jobStore = createJobStore(ctx);
  const serialStore = createSerialStore();

  router.get("/arduino-flash/status", async (req, res) => {
    try {
      const result = await runArduinoCli(ctx, ["version"], { timeout: 5000 });
      res.json({ ok: true, arduinoCliAvailable: true, version: (result.stdout || result.stderr).trim() });
    } catch (err) {
      res.status(err?.code === "ARDUINO_CLI_MISSING" ? 200 : 500).json({
        ok: false,
        arduinoCliAvailable: false,
        error: err?.message || "Unable to run arduino-cli.",
        installHint: "Install Arduino CLI, then run: arduino-cli core update-index",
      });
    }
  });

  router.get("/arduino-flash/ports", async (req, res) => {
    try {
      res.json({ ports: await listSerialPorts(), serialSupportAvailable: true });
    } catch (err) {
      if (isSerialDependencyUnavailable(err)) {
        return res.status(200).json({ ports: [], ...serialUnavailablePayload(err) });
      }
      res.status(500).json({ error: err?.message || "Failed to list serial ports." });
    }
  });

  router.get("/arduino-flash/boards/detected", async (req, res) => {
    try {
      const result = await runArduinoCli(ctx, ["board", "list", "--format", "json"]);
      const parsed = parseJsonMaybe(result.stdout);
      const ports = Array.isArray(parsed) ? parsed : parsed?.ports;
      const boards = Array.isArray(ports) ? ports.map(normalizePortRecord).filter((p) => p.port) : parseBoardListText(result.stdout);
      res.json({ boards, raw: result.stdout });
    } catch (err) {
      res.status(err?.code === "ARDUINO_CLI_MISSING" ? 400 : 500).json({ error: err?.message || "Failed to list detected boards." });
    }
  });

  router.get("/arduino-flash/boards", async (req, res) => {
    try {
      let result;
      try {
        result = await runArduinoCli(ctx, ["board", "listall", "--format", "json"]);
      } catch {
        result = await runArduinoCli(ctx, ["board", "listall"]);
      }
      const parsed = parseJsonMaybe(result.stdout);
      const rawBoards = Array.isArray(parsed) ? parsed : parsed?.boards;
      const boards = Array.isArray(rawBoards)
        ? rawBoards.map((b) => ({ name: b.name || b.board || b.fqbn || "", fqbn: b.fqbn || "", label: `${b.name || b.fqbn} (${b.fqbn || "no FQBN"})` }))
        : parseBoardListAllText(result.stdout);
      res.json({ boards: boards.filter((b) => b.fqbn), raw: result.stdout });
    } catch (err) {
      res.status(err?.code === "ARDUINO_CLI_MISSING" ? 400 : 500).json({ error: err?.message || "Failed to list boards." });
    }
  });

  router.get("/arduino-flash/libraries", async (req, res) => {
    try {
      let result;
      try {
        result = await runArduinoCli(ctx, ["lib", "list", "--format", "json"]);
      } catch {
        result = await runArduinoCli(ctx, ["lib", "list"]);
      }
      const parsed = parseJsonMaybe(result.stdout);
      const rawLibraries = Array.isArray(parsed) ? parsed : parsed?.installed_libraries || parsed?.libraries;
      const libraries = Array.isArray(rawLibraries)
        ? rawLibraries.map((lib) => ({ name: lib.library?.name || lib.name || "", version: lib.library?.version || lib.version || "", location: lib.library?.install_dir || lib.location || "", raw: lib }))
        : parseLibrariesText(result.stdout);
      res.json({ libraries, raw: result.stdout });
    } catch (err) {
      res.status(err?.code === "ARDUINO_CLI_MISSING" ? 400 : 500).json({ error: err?.message || "Failed to list Arduino libraries." });
    }
  });

  router.post("/arduino-flash/libraries/install", async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      if (!/^[\w .:+@/-]{1,120}$/.test(name)) throw new Error("Enter a valid Arduino library name.");
      const job = jobStore.createJob({ kind: "library install", args: ["lib", "install", name] });
      res.json({ jobId: job.id });
    } catch (err) {
      res.status(400).json({ error: err?.message || "Failed to start library install." });
    }
  });

  router.post("/arduino-flash/verify", async (req, res) => {
    try {
      const sketch = await resolveNotebookIno(ctx, req.body?.filePath);
      const fqbn = validateFqbn(req.body?.fqbn);
      const job = jobStore.createJob({ kind: "verify", args: ["compile", "--fqbn", fqbn, sketch.sketchPath] });
      res.json({ jobId: job.id, filePath: sketch.relativePath });
    } catch (err) {
      res.status(400).json({ error: err?.message || "Failed to start verify." });
    }
  });

  router.post("/arduino-flash/upload", async (req, res) => {
    try {
      const sketch = await resolveNotebookIno(ctx, req.body?.filePath);
      const fqbn = validateFqbn(req.body?.fqbn);
      const port = await validatePort(req.body?.port);
      const job = jobStore.createJob({ kind: "upload", args: ["upload", "-p", port, "--fqbn", fqbn, sketch.sketchPath] });
      res.json({ jobId: job.id, filePath: sketch.relativePath });
    } catch (err) {
      if (isSerialDependencyUnavailable(err)) {
        return res.status(503).json(serialUnavailablePayload(err));
      }
      res.status(400).json({ error: err?.message || "Failed to start upload." });
    }
  });

  router.get("/arduino-flash/jobs/:jobId/events", (req, res) => {
    const job = jobStore.jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    job.lines.forEach((line) => send("log", line));
    if (job.status !== "running") send("done", { status: job.status, exitCode: job.exitCode, error: job.error });
    const onEvent = (entry) => send("log", entry);
    const onDone = (doneJob) => {
      send("done", { status: doneJob.status, exitCode: doneJob.exitCode, error: doneJob.error });
      res.end();
    };
    job.events.on("event", onEvent);
    job.events.once("done", onDone);
    req.on("close", () => {
      job.events.off("event", onEvent);
      job.events.off("done", onDone);
    });
  });

  router.post("/arduino-flash/serial/connect", async (req, res) => {
    try {
      const port = await validatePort(req.body?.port);
      const baudRate = Number(req.body?.baudRate || 9600);
      const state = await serialStore.connect({ port, baudRate });
      res.json({ connected: true, port: state.port, baudRate: state.baudRate });
    } catch (err) {
      if (isSerialDependencyUnavailable(err)) {
        return res.status(503).json(serialUnavailablePayload(err));
      }
      res.status(400).json({ error: err?.message || "Serial connection failed." });
    }
  });

  router.post("/arduino-flash/serial/disconnect", async (req, res) => {
    const port = String(req.body?.port || "").trim();
    res.json({ disconnected: await serialStore.disconnect(port) });
  });

  router.post("/arduino-flash/serial/write", async (req, res) => {
    try {
      const port = String(req.body?.port || "").trim();
      const state = serialStore.get(port);
      if (!state?.serial?.isOpen) throw new Error("Serial port is not connected.");
      const text = String(req.body?.text ?? "");
      await new Promise((resolve, reject) => state.serial.write(text + (req.body?.newline === false ? "" : "\n"), (err) => err ? reject(err) : resolve()));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err?.message || "Failed to write to serial port." });
    }
  });

  router.get("/arduino-flash/serial/events", (req, res) => {
    const port = String(req.query?.port || "").trim();
    const state = serialStore.get(port);
    if (!state) return res.status(404).json({ error: "Serial port is not connected." });
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    const send = (entry) => res.write(`event: serial\ndata: ${JSON.stringify(entry)}\n\n`);
    state.lines.forEach(send);
    const onEvent = (entry) => send(entry);
    state.events.on("event", onEvent);
    req.on("close", () => state.events.off("event", onEvent));
  });

  return router;
}

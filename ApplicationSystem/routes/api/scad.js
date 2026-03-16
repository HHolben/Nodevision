// Nodevision/ApplicationSystem/routes/api/scad.js
// This file defines the scad API route handler for the Nodevision server. It validates requests and sends responses for scad operations.

import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createServerContext } from "../../shared/serverContext.mjs";

const BASE_CONTEXT = createServerContext();

function runOpenSCAD({ openscadBin = "openscad", inputPath, outputPath, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const args = ["-o", outputPath, inputPath];
    const child = spawn(openscadBin, args, { stdio: ["ignore", "pipe", "pipe"] });

    /** @type {Buffer[]} */
    const stdout = [];
    /** @type {Buffer[]} */
    const stderr = [];

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`OpenSCAD timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (d) => stdout.push(Buffer.from(d)));
    child.stderr.on("data", (d) => stderr.push(Buffer.from(d)));

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
      } else {
        const errText = Buffer.concat(stderr).toString("utf8").trim();
        reject(new Error(errText || `OpenSCAD exited with code ${code}`));
      }
    });
  });
}

export default function createSCADRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();

  router.post("/scad/render", async (req, res) => {
    if (!req.identity) return res.status(401).json({ error: "Authentication required" });

    const { scadCode, format = "stl" } = req.body || {};
    if (format !== "stl") return res.status(400).json({ error: "Only format=stl is supported" });
    if (typeof scadCode !== "string") return res.status(400).json({ error: "scadCode must be a string" });
    if (scadCode.length > 5_000_000) return res.status(413).json({ error: "scadCode too large" });
    if (!scadCode.trim()) return res.status(400).json({ error: "Empty scadCode" });

    const cacheRoot = ctx.cacheDir || os.tmpdir();
    await fs.mkdir(cacheRoot, { recursive: true });

    const tmpDir = await fs.mkdtemp(path.join(cacheRoot, "scad-"));
    const inputPath = path.join(tmpDir, "model.scad");
    const outputPath = path.join(tmpDir, "model.stl");

    try {
      await fs.writeFile(inputPath, scadCode, "utf8");
      await runOpenSCAD({ inputPath, outputPath, timeoutMs: 30000 });
      const out = await fs.readFile(outputPath);
      res.setHeader("Content-Type", "application/sla");
      res.setHeader("Cache-Control", "no-store");
      res.send(out);
    } catch (err) {
      const msg = err?.message || String(err);
      const missing = typeof msg === "string" && (msg.includes("ENOENT") || msg.toLowerCase().includes("not found"));
      const hint = missing ? "OpenSCAD CLI not found on server PATH (expected `openscad`)." : undefined;
      res.status(500).json({ error: msg, hint });
    } finally {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // Best effort.
      }
    }
  });

  return router;
}

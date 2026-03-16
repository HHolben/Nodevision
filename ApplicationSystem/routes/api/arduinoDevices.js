// Nodevision/ApplicationSystem/routes/api/arduinoDevices.js
// This file defines the arduino Devices API route handler for the Nodevision server. It validates requests and sends responses for arduino Devices operations.
// routes/api/arduinoDevices.js
// Purpose: List connected Arduino (or Arduino-like) devices for UI selection.

import express from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SerialPort } from "serialport";

const execFileAsync = promisify(execFile);

function normalizeHex(value) {
  if (!value) return "";
  return String(value).trim().replace(/^0x/i, "").toLowerCase();
}

function isLikelyArduino(portInfo = {}) {
  const manufacturer = String(portInfo.manufacturer || "").toLowerCase();
  if (manufacturer.includes("arduino")) return true;

  const vendorId = normalizeHex(portInfo.vendorId);
  // Common Arduino / clone / USB-serial VID values:
  // - 2341 / 2a03: Arduino SA / Arduino LLC
  // - 1a86: CH340
  // - 10c4: Silicon Labs CP210x
  // - 0403: FTDI
  // - 16c0: Teensy / PJRC (not Arduino, but often used similarly)
  const likelyVids = new Set(["2341", "2a03", "1a86", "10c4", "0403", "16c0"]);
  if (vendorId && likelyVids.has(vendorId)) return true;

  return false;
}

function toDeviceLabel(p) {
  const bits = [];
  if (p.boardName) bits.push(p.boardName);
  if (p.fqbn) bits.push(`(${p.fqbn})`);
  if (p.port) bits.push(p.port);
  return bits.join(" ") || p.port || "Unknown device";
}

async function listViaArduinoCli() {
  const attempts = [
    // Newer Arduino CLI versions commonly support --format json.
    { args: ["board", "list", "--format", "json"] },
    // Some versions use --json.
    { args: ["board", "list", "--json"] },
  ];

  for (const attempt of attempts) {
    try {
      const { stdout } = await execFileAsync("arduino-cli", attempt.args, {
        timeout: 10_000,
        maxBuffer: 2 * 1024 * 1024,
      });

      const text = String(stdout || "").trim();
      if (!text) continue;
      const parsed = JSON.parse(text);

      // Expected shape (varies by version):
      // - { ports: [ { address, protocol, boards: [ { name, fqbn } ] } ] }
      // - or [ ...ports ]
      const ports = Array.isArray(parsed) ? parsed : parsed?.ports;
      if (!Array.isArray(ports)) continue;

      const devices = ports
        .map((p) => {
          const address = p?.address || p?.port || p?.path;
          const boards = Array.isArray(p?.boards) ? p.boards : [];
          const primaryBoard = boards[0] || null;
          const fqbn = primaryBoard?.fqbn || "";
          const boardName = primaryBoard?.name || "";
          const device = {
            port: address || "",
            protocol: p?.protocol || "",
            boardName,
            fqbn,
            isArduinoLikely: true,
            raw: p,
          };
          device.label = toDeviceLabel(device);
          return device;
        })
        .filter((d) => d.port);

      return { ok: true, source: "arduino-cli", devices };
    } catch {
      // fall through to next attempt
    }
  }

  return { ok: false, source: "arduino-cli", devices: [] };
}

async function listViaSerialPort() {
  const ports = await SerialPort.list();
  const mapped = ports
    .map((p) => {
      const device = {
        port: p.path,
        manufacturer: p.manufacturer || "",
        serialNumber: p.serialNumber || "",
        vendorId: p.vendorId || "",
        productId: p.productId || "",
        isArduinoLikely: isLikelyArduino(p),
        raw: p,
      };
      device.label =
        [p.manufacturer, p.friendlyName].filter(Boolean).join(" — ") ||
        p.path;
      return device;
    })
    .filter((d) => d.port);

  const likely = mapped.filter((d) => d.isArduinoLikely);
  const devices = likely.length > 0 ? likely : mapped;
  return { ok: true, source: "serialport", devices, filtered: likely.length > 0 };
}

export default function createArduinoDevicesRouter() {
  const router = express.Router();

  router.get("/arduino/devices", async (req, res) => {
    try {
      const cli = await listViaArduinoCli();
      if (cli.ok && cli.devices.length > 0) {
        return res.json({
          devices: cli.devices,
          source: cli.source,
          arduinoCliAvailable: true,
        });
      }

      const serial = await listViaSerialPort();
      return res.json({
        devices: serial.devices,
        source: serial.source,
        filtered: Boolean(serial.filtered),
        arduinoCliAvailable: false,
      });
    } catch (err) {
      console.error("[arduinoDevices] Failed to list devices:", err);
      res.status(500).json({ error: err.message || "Failed to list devices" });
    }
  });

  return router;
}

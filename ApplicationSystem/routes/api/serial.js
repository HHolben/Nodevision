// Nodevision/ApplicationSystem/routes/api/serial.js
// This file defines the serial API route handler for the Nodevision server. It validates requests and sends responses for serial operations.
// routes/api/serial.js
// Purpose: Serial port communication and Arduino integration

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import {
  isSerialDependencyUnavailable,
  loadSerialDependencies,
  serialUnavailablePayload,
} from "./serialDependencies.mjs";
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();
const SERIAL_PORT_PATH = "/dev/ttyUSB1";
const BAUD_RATE = 115200;

let serialConnection = null;
let parser = null;

async function initializeSerialConnection(io, csvFilePath) {
  if (serialConnection) {
    return serialConnection;
  }

  if (!fs.existsSync(SERIAL_PORT_PATH)) {
    console.log(`No serial device found at ${SERIAL_PORT_PATH}`);
    return null;
  }

  const { SerialPort, ReadlineParser } = await loadSerialDependencies();

  try {
    serialConnection = new SerialPort({ path: SERIAL_PORT_PATH, baudRate: BAUD_RATE });
    parser = serialConnection.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', async (line) => {
      console.log('Received from serial:', line);
      try {
        await fsPromises.appendFile(csvFilePath, line.trim() + "\n", 'utf8');
        console.log('Data appended to CSV.');
      } catch (error) {
        console.error('Error appending to CSV:', error);
      }
      io?.of('/serial-monitor')?.emit('serial-data', line.trim());
    });

    serialConnection.on('error', (err) => {
      console.error('Serial connection error:', err);
      serialConnection = null;
    });

    console.log(`Serial connection initialized at ${SERIAL_PORT_PATH}`);
    return serialConnection;
  } catch (error) {
    console.error("Error initializing serial connection:", error);
    serialConnection = null;
    return null;
  }
}

export default function createSerialRouter(ctx = BASE_CONTEXT) {
  const NOTEBOOK_DIR = ctx.notebookDir;
  const CSV_FILE_PATH = path.join(NOTEBOOK_DIR, 'data.csv');
  const router = express.Router();

  router.post('/send-serial-command', express.json(), async (req, res) => {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: "Missing 'command' in request body." });
    }

    try {
      const routeIo = ctx.io || globalThis.io || null;
      const portInstance = await initializeSerialConnection(routeIo, CSV_FILE_PATH);
      if (!portInstance) {
        return res.status(503).json({ error: "No serial device connected." });
      }

      portInstance.write(command + "\n", (err) => {
        if (err) {
          console.error('Error writing to serial:', err);
          return res.status(500).json({ error: "Error writing to serial." });
        }
        res.json({ message: "Command sent successfully!", command });
      });
    } catch (err) {
      if (isSerialDependencyUnavailable(err)) {
        return res.status(503).json(serialUnavailablePayload(err));
      }
      console.error('Error preparing serial command:', err);
      res.status(500).json({ error: err?.message || "Error preparing serial command." });
    }
  });

  router.get('/serial-status', (req, res) => {
    const isConnected = serialConnection !== null;
    res.json({ connected: isConnected });
  });

  return router;
}

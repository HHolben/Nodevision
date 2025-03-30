const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const router = express.Router();

// Configuration
const SERIAL_PORT_PATH = "/dev/ttyUSB1"; // update to your device's path
const BAUD_RATE = 115200;
const CSV_FILE_PATH = path.join(__dirname, '../../Notebook', 'data.csv');

let serialConnection = null;
let parser = null; // Reference to the parser

/**
 * Initializes the serial connection if not already open.
 * Sets up a parser that writes data to CSV and emits serial data over Socket.IO.
 */
function initializeSerialConnection(io) {
  if (serialConnection) {
    return serialConnection;
  }

  if (!fs.existsSync(SERIAL_PORT_PATH)) {
    console.log(`No serial device found at ${SERIAL_PORT_PATH}`);
    return null;
  }

  try {
    serialConnection = new SerialPort({ path: SERIAL_PORT_PATH, baudRate: BAUD_RATE });
    parser = serialConnection.pipe(new ReadlineParser({ delimiter: '\n' }));

    // When data arrives, write to CSV and broadcast via Socket.IO.
    parser.on('data', async (line) => {
      console.log('Received from serial:', line);
      try {
        await fsPromises.appendFile(CSV_FILE_PATH, line.trim() + "\n", 'utf8');
        console.log('Data appended to CSV.');
      } catch (error) {
        console.error('Error appending to CSV:', error);
      }
      // Emit the data to all clients connected to the "/serial-monitor" namespace.
      io.of('/serial-monitor').emit('serial-data', line.trim());
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

// Endpoint to send a command to the serial device.
router.post('/send-serial-command', express.json(), (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: "Missing 'command' in request body." });
  }

  // 'io' should have been attached to req.app.locals by the main server.
  const io = req.app.locals.io;
  const portInstance = initializeSerialConnection(io);
  if (!portInstance) {
    return res.status(500).json({ error: "No serial device connected." });
  }

  portInstance.write(command + "\n", (err) => {
    if (err) {
      console.error('Error writing to serial:', err);
      return res.status(500).json({ error: "Error writing to serial." });
    }
    res.json({ message: "Command sent successfully!", command });
  });
});

// Endpoint to check serial connection status.
router.get('/serial-status', (req, res) => {
  const isConnected = serialConnection !== null;
  res.json({ connected: isConnected });
});

module.exports = (io) => {
  // Initialize serial connection with the passed Socket.IO instance.
  initializeSerialConnection(io);

  // Return the configured router.
  return router;
};

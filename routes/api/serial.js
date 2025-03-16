const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const router = express.Router();

// Change these to match your system’s configuration.
const SERIAL_PORT_PATH = "/dev/ttyUSB1"; // update to your actual device path if different
const BAUD_RATE = 115200;
const CSV_FILE_PATH = path.join(__dirname, '../../Notebook', 'data.csv');

// We'll store the active serial connection here.
let serialConnection = null;

// Function to initialize the serial connection on demand
function initializeSerialConnection() {
  if (serialConnection) {
    return serialConnection;
  }

  // Check if the serial device exists (this works on Linux/macOS)
  if (!fs.existsSync(SERIAL_PORT_PATH)) {
    console.log(`No serial device found at ${SERIAL_PORT_PATH}`);
    return null;
  }

  try {
    serialConnection = new SerialPort({ path: SERIAL_PORT_PATH, baudRate: BAUD_RATE });
    const parser = serialConnection.pipe(new ReadlineParser({ delimiter: '\n' }));

    // Attach a listener for incoming serial data
    parser.on('data', async (line) => {
      console.log('Received from serial:', line);
      try {
        // Append the received line to the CSV file (with a newline)
        await fsPromises.appendFile(CSV_FILE_PATH, line.trim() + "\n", 'utf8');
        console.log('Data appended to CSV.');
      } catch (error) {
        console.error('Error appending to CSV:', error);
      }
    });

    // Listen for errors on the serial connection
    serialConnection.on('error', (err) => {
      console.error('Serial connection error:', err);
      // Reset the connection so that a future attempt can reinitialize it
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

// Endpoint to send a command to the serial device
router.post('/send-serial-command', (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: "Missing 'command' in request body." });
  }

  // Try to initialize or retrieve the serial connection
  const portInstance = initializeSerialConnection();
  if (!portInstance) {
    return res.status(500).json({ error: "No serial device connected." });
  }

  // Write the command over serial
  portInstance.write(command + "\n", (err) => {
    if (err) {
      console.error('Error writing to serial:', err);
      return res.status(500).json({ error: "Error writing to serial." });
    }
    res.json({ message: "Command sent successfully!", command });
  });
});

// (Optional) Provide an endpoint to check serial connection status.
router.get('/serial-status', (req, res) => {
  const isConnected = serialConnection !== null;
  res.json({ connected: isConnected });
});

module.exports = router;

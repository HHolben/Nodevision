// ServerOscilloscope.js (CommonJS, safe startup without Arduino)
// Purpose: Real-time data streaming and oscilloscope functionality

const { SerialPort, ReadlineParser } = require('serialport');
const { WebSocketServer } = require('ws');

const portPath = '/dev/ttyUSB0'; // Change if needed
let port;
let parser;

const wss = new WebSocketServer({ port: 8081 });
console.log('Scope server running on ws://localhost:8081');

// Try to open serial port
try {
  port = new SerialPort({ path: portPath, baudRate: 115200 });
  parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  parser.on('data', (line) => {
    const value = parseInt(line.trim(), 10);
    if (!isNaN(value)) {
      broadcast({ value, timestamp: Date.now() });
    }
  });

  port.on('open', () => {
    console.log(`Serial port open: ${portPath}`);
  });

  port.on('error', (err) => {
    console.error('Serial port error:', err.message);
  });

} catch (err) {
  console.error(`Could not open ${portPath}:`, err.message);
  console.log('Running in no-Arduino mode.');
}

// Send dummy data every 50ms if no parser is active
setInterval(() => {
  if (!parser) {
    const t = Date.now() / 200;
    const simulatedValue = Math.round((Math.sin(t) * 0.5 + 0.5) * 1023);
    broadcast({ value: simulatedValue, timestamp: Date.now() });
  }
}, 50);

// Broadcast helper
function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

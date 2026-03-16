// Nodevision/ApplicationSystem/sendRequest.js
// This file defines the send Request module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
// sendRequest.js
// Purpose: HTTP request handling and API communication utilities

const http = require('http');
const args = process.argv.slice(2);

const endpoint = args[0];
const command = args[1];

if (!endpoint || !command) {
  console.error('❌ Endpoint and command are required.');
  process.exit(1);
}

console.log(`🟢 Sending request to ${endpoint} with command: ${command}`);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: endpoint,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const data = JSON.stringify({ command });

const req = http.request(options, (res) => {
  let responseData = '';

  console.log(`🔵 Status Code: ${res.statusCode}`);

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`🟢 Response received: ${responseData}`);
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
});

req.write(data);
req.end();
console.log('🟡 Request sent, waiting for response...');

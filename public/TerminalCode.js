// public/TerminalCode.js
// Purpose: TODO: Add description of module purpose

const http = require('http');
const args = process.argv.slice(2);

// Ensure both endpoint and command are passed as arguments
const endpoint = args[0];
const command = args[1];

if (!endpoint || !command) {
  console.error('Endpoint and command are required.');
  process.exit(1);
}

// Options for the request (assuming the endpoint is on localhost:3000)
const options = {
  hostname: 'localhost',
  port: 3000,
  path: endpoint,  // Path from the frontend
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

// Prepare the request body
const data = JSON.stringify({ command });

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(responseData);  // This will be captured by the server and sent back to the client
  });
});

// Handle request errors
req.on('error', (error) => {
  console.error('Request failed:', error);
});

// Write the request body and end the request
req.write(data);
req.end();

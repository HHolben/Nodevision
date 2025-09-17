// start-servers.js
// Purpose: Launch dual server setup (Node.js + PHP) using concurrently with configuration from config.json

import concurrently from 'concurrently';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const phpPort = config.phpPort;
const nodePort = config.nodePort;

concurrently([
  { 
    command: `php -S 0.0.0.0:${phpPort} -t Notebook`, 
    name: 'php', 
    prefixColor: 'green'
  },
  { 
    command: `PORT=${nodePort} node server.js`, 
    name: 'node', 
    prefixColor: 'blue'
  }
])

/*.then(result => {
  console.log('Both servers have started successfully.');
}).catch(error => {
  console.error('One or both of the servers failed to start.', error);
});

*/

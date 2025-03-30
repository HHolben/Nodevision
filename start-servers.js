const concurrently = require('concurrently');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const phpPort = config.phpPort;
const nodePort = config.nodePort;

concurrently([
  { 
    command: `php -S localhost:${phpPort} -t Notebook`, 
    name: 'php', 
    prefixColor: 'green'
  },
  { 
    command: `node server.js`, 
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

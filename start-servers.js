// Nodevision/start-servers.js
// Purpose: Launch dual server setup (Node.js + PHP) using concurrently with configuration sourced from ApplicationSystem/config.json

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const applicationSystemDir = path.join(__dirname, 'ApplicationSystem');
const requireFromAppSystem = createRequire(path.join(applicationSystemDir, 'package.json'));
const concurrently = requireFromAppSystem('concurrently');
const configPath = path.join(applicationSystemDir, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const phpPort = config.phpPort;
const nodePort = config.nodePort;
const phpDocRoot = path.join(__dirname, 'Notebook');
const nodeServerPath = path.join(applicationSystemDir, 'server.js');

const run = concurrently([
  { 
    command: `php -S 0.0.0.0:${phpPort} -t "${phpDocRoot}"`, 
    name: 'php', 
    prefixColor: 'green'
  },
  { 
    command: `node "${nodeServerPath}"`,
    name: 'node', 
    prefixColor: 'blue',
    env: {
      ...process.env,
      PORT: String(nodePort)
    }
  }
], {
  // Keep Node alive even if PHP fails to bind (e.g., port already in use).
  killOthers: [],
  restartTries: 0,
});

run.result.catch((events) => {
  const failures = Array.isArray(events)
    ? events.filter((event) => Number(event?.exitCode) !== 0)
    : [];

  const onlyPhpFailed =
    failures.length === 1 &&
    String(failures[0]?.command?.name || "").toLowerCase() === "php";

  if (onlyPhpFailed) {
    console.warn(
      "[start-servers] PHP server failed to start (likely port already in use). " +
      "Continuing with Node server."
    );
    return;
  }

  console.error("[start-servers] One or more processes exited with failure:", failures);
  process.exitCode = 1;
});

/*.then(result => {
  console.log('Both servers have started successfully.');
}).catch(error => {
  console.error('One or both of the servers failed to start.', error);
});

*/

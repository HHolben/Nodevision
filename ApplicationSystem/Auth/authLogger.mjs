import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const LOGS_DIR = path.join(ROOT_DIR, 'Accounts', 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'auth.log');

async function ensureLogDir() {
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

export async function logEvent(event, metadata = {}) {
  await ensureLogDir();
  const timestamp = new Date().toISOString();
  const pairs = Object.entries(metadata)
    .filter(([key, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');

  const line = `${timestamp} ${event}${pairs ? ' ' + pairs : ''}\n`;
  await fs.appendFile(LOG_FILE, line, 'utf8');
}

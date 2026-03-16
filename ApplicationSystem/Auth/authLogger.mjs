// Nodevision/ApplicationSystem/Auth/authLogger.mjs
// This file defines auth Logger authentication logic for the Nodevision server. It manages user identity and secures session operations.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerContext } from '../shared/serverContext.mjs';

const ctx = createServerContext();
const LOGS_DIR = ctx.accountsLogsDir;
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

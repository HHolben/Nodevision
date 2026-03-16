// Nodevision/ApplicationSystem/shared/serverContext.mjs
// This file constructs the Nodevision server runtime context and ensures standard directories exist so that server routes can resolve filesystem paths consistently.

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const HOME_DIR_ROOT = path.join(os.homedir(), 'Nodevision');
const PACKAGED_ROOT = path.dirname(process.execPath);

function getDefaultRuntimeRoot() {
  if (process.env.NODEVISION_ROOT) return process.env.NODEVISION_ROOT;
  if (typeof process.pkg !== 'undefined') return PACKAGED_ROOT;
  return HOME_DIR_ROOT;
}

export function createServerContext(overrides = {}) {
  const runtimeRoot = overrides.runtimeRoot ?? getDefaultRuntimeRoot();
  const applicationSystemRoot = overrides.applicationSystemRoot ?? path.resolve(runtimeRoot, 'ApplicationSystem');
  const notebookDir = overrides.notebookDir ?? path.join(runtimeRoot, 'Notebook');
  const userSettingsDir = overrides.userSettingsDir ?? path.join(runtimeRoot, 'UserSettings');
  const userDataDir = overrides.userDataDir ?? path.join(runtimeRoot, 'UserData');
  const sharedDataDir = overrides.sharedDataDir ?? path.join(userDataDir, 'data');
  const publicDir = overrides.publicDir ?? path.join(applicationSystemRoot, 'public');
  const routesJsonPath = overrides.routesJsonPath ?? path.join(applicationSystemRoot, 'routes.json');
  const nodeModulesDir = overrides.nodeModulesDir ?? path.join(applicationSystemRoot, 'node_modules');
  const legacyConfigDir = path.join(runtimeRoot, 'Config');
  const legacyCacheDir = path.join(runtimeRoot, 'Cache');
  const legacyLogsDir = path.join(runtimeRoot, 'Logs');
  const legacyAccountsDir = path.join(runtimeRoot, 'Accounts');

  const serverDataDir = overrides.serverDataDir ?? path.join(runtimeRoot, 'ServerData');

  const accountsDir = overrides.accountsDir ??
    (fs.existsSync(serverDataDir) ? serverDataDir : (fs.existsSync(legacyAccountsDir) ? legacyAccountsDir : serverDataDir));
  const accountsDataDir = overrides.accountsDataDir ?? path.join(accountsDir, 'data');
  const accountsLogsDir = overrides.accountsLogsDir ?? path.join(accountsDir, 'logs');

  const configDir = overrides.configDir ??
    (fs.existsSync(legacyConfigDir) ? legacyConfigDir : path.join(userSettingsDir, 'Config'));
  const cacheDir = overrides.cacheDir ??
    (fs.existsSync(legacyCacheDir) ? legacyCacheDir : path.join(accountsDir, 'cache'));
  const logsDir = overrides.logsDir ??
    (fs.existsSync(legacyLogsDir) ? legacyLogsDir : accountsLogsDir);
  const gamepadSettingsFile = overrides.gamepadSettingsFile ??
    path.join(userSettingsDir, 'KeyboardAndControlSchemes', 'GameControllerSettings.json');

  return {
    runtimeRoot,
    applicationSystemRoot,
    notebookDir,
    userSettingsDir,
    userDataDir,
    sharedDataDir,
    publicDir,
    routesJsonPath,
    nodeModulesDir,
    configDir,
    cacheDir,
    logsDir,
    serverDataDir,
    accountsDir,
    accountsDataDir,
    accountsLogsDir,
    gamepadSettingsFile,
  };
}

export function ensureServerDirectories(ctx) {
  const dirs = [
    ctx.runtimeRoot,
    ctx.userSettingsDir,
    ctx.notebookDir,
    ctx.userDataDir,
    ctx.sharedDataDir,
    ctx.serverDataDir,
    ctx.accountsDir,
    ctx.accountsDataDir,
    ctx.accountsLogsDir,
    path.dirname(ctx.gamepadSettingsFile),
    ctx.configDir,
    ctx.cacheDir,
    ctx.logsDir,
  ];

  for (const dir of dirs) {
    if (!dir) continue;
    fs.mkdirSync(dir, { recursive: true });
  }
}

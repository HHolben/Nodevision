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
  const configDir = overrides.configDir ?? path.join(runtimeRoot, 'Config');
  const cacheDir = overrides.cacheDir ?? path.join(runtimeRoot, 'Cache');
  const logsDir = overrides.logsDir ?? path.join(runtimeRoot, 'Logs');
  const accountsDir = overrides.accountsDir ?? path.join(runtimeRoot, 'Accounts');
  const accountsDataDir = overrides.accountsDataDir ?? path.join(accountsDir, 'data');
  const accountsLogsDir = overrides.accountsLogsDir ?? path.join(accountsDir, 'logs');
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

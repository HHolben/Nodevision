// Nodevision/electron-main.js
// This entry module starts the desktop runtime, owns the main application window, and registers Electron permissions, application lifecycle handlers, and desktop integrations.
import { app, BrowserWindow, Menu, ipcMain, session, clipboard, nativeImage } from 'electron';
import { createElectronPdfExporter } from './ApplicationSystem/Desktop/ElectronPdfExport.mjs';
import { installElectronHtmlHistory } from './ApplicationSystem/Desktop/ElectronHtmlHistory.mjs';
import { registerElectronFileInterop } from './ApplicationSystem/Desktop/ElectronFileInterop.mjs';
import { createServerContext } from './ApplicationSystem/shared/serverContext.mjs';
import { createRuntime } from './ApplicationSystem/core/runtime.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the runtime and preload paths from this entry module.
if (!process.env.NODEVISION_ROOT) {
  process.env.NODEVISION_ROOT = path.dirname(fileURLToPath(import.meta.url));
}

const ELECTRON_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PRELOAD_PATH = path.join(ELECTRON_ROOT, 'electron-preload.cjs');

const desktopOpenArgs = process.argv.slice(2);

const runtime = createRuntime({
  port: 3000,
  host: process.env.HOST || '127.0.0.1',
  dev: false,
  desktopOpenArgs,
});
const electronServerContext = createServerContext({ runtimeRoot: process.env.NODEVISION_ROOT });

let runtimeInstance = null;
let mainWindow = null;

// Limit geolocation permissions to the running application origin.
function isNodevisionRuntimeUrl(rawUrl) {
  try {
    if (!runtimeInstance?.url) return false;
    const requested = new URL(String(rawUrl || ""));
    const runtimeUrl = new URL(runtimeInstance.url);
    return requested.protocol === runtimeUrl.protocol
      && requested.hostname === runtimeUrl.hostname
      && requested.port === runtimeUrl.port;
  } catch {
    return false;
  }
}

function installPermissionHandlers() {
  const allowGeolocation = (webContents, rawUrl) => isNodevisionRuntimeUrl(rawUrl || webContents?.getURL?.());

  if (typeof session.defaultSession.setPermissionCheckHandler === "function") {
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      return permission === "geolocation" && allowGeolocation(webContents, requestingOrigin);
    });
  }

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    if (permission === "geolocation") {
      callback(allowGeolocation(webContents, details.requestingUrl));
      return;
    }
    callback(false);
  });
}

// Start the runtime and create the main window once.
export async function startElectronApp() {
  if (!runtimeInstance) {
    runtimeInstance = await runtime.start();
    installPermissionHandlers();
  }
  if (!mainWindow) {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: PRELOAD_PATH,
      },
      autoHideMenuBar: true,
      menuBarVisible: false,
    });

    installElectronHtmlHistory(mainWindow.webContents);
    await mainWindow.loadURL(runtimeInstance.url);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
  return mainWindow;
}

// Register desktop integrations and application lifecycle events.
export function setupElectronHandlers() {
  ipcMain.handle('nodevision:export-html-to-pdf', createElectronPdfExporter(() => mainWindow));
  registerElectronFileInterop({
    ipcMain,
    clipboard,
    nativeImage,
    getNotebookDir: () => electronServerContext.notebookDir,
  });

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    startElectronApp().catch((err) => {
      console.error('[electron-main] Failed to open window', err);
      app.quit();
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      startElectronApp().catch((err) => {
        console.error('[electron-main] Failed to recreate window', err);
      });
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('second-instance', (_event, argv) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    console.log('[electron-main] Additional desktop-open arguments require a new launcher process:', argv.slice(2));
  });

  app.on('before-quit', () => {
    if (runtimeInstance?.stop) {
      runtimeInstance.stop().catch((err) => {
        console.error('[electron-main] Failed to stop Nodevision runtime', err);
      });
    }
  });
}

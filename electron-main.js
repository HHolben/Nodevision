import { app, BrowserWindow, Menu } from 'electron';
import { createRuntime } from './ApplicationSystem/core/runtime.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.NODEVISION_ROOT) {
  process.env.NODEVISION_ROOT = path.dirname(fileURLToPath(import.meta.url));
}

const runtime = createRuntime({
  port: 3000,
  host: '127.0.0.1',
  dev: false,
});

let runtimeInstance = null;
let mainWindow = null;

export async function startElectronApp() {
  if (!runtimeInstance) {
    runtimeInstance = await runtime.start();
  }
  if (!mainWindow) {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      autoHideMenuBar: true,
      menuBarVisible: false,
    });

    await mainWindow.loadURL(runtimeInstance.url);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
  return mainWindow;
}

export function setupElectronHandlers() {
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

  app.on('before-quit', () => {
    if (runtimeInstance?.stop) {
      runtimeInstance.stop().catch((err) => {
        console.error('[electron-main] Failed to stop Nodevision runtime', err);
      });
    }
  });
}

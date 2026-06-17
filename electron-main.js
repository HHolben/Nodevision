import { app, BrowserWindow, Menu, dialog, ipcMain, session } from 'electron';
import { createRuntime } from './ApplicationSystem/core/runtime.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

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

let runtimeInstance = null;
let mainWindow = null;

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

    await mainWindow.loadURL(runtimeInstance.url);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
  return mainWindow;
}

async function waitForPrintableContent(win) {
  await win.webContents.executeJavaScript(`
    Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => null) : Promise.resolve(null),
      Promise.all(Array.from(document.images || []).map((img) => {
        if (img.complete) return Promise.resolve(null);
        return new Promise((resolve) => {
          img.addEventListener('load', () => resolve(null), { once: true });
          img.addEventListener('error', () => resolve(null), { once: true });
          setTimeout(() => resolve(null), 4000);
        });
      })),
    ]).then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  `);
}

function ensureHtmlDocument(html, baseUrl) {
  const source = String(html || '');
  const baseTag = baseUrl ? `<base href="${String(baseUrl).replace(/"/g, '&quot;')}">` : '';
  if (/<!doctype html/i.test(source) || /<html[\s>]/i.test(source)) {
    if (!baseTag) return source;
    if (/<head[\s>]/i.test(source)) {
      return source.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    }
    return source.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8">${baseTag}</head><body>${source}</body></html>`;
}

async function exportHtmlToPdf(_event, payload = {}) {
  const html = String(payload.html || '');
  if (!html.trim()) throw new Error('No HTML content was provided.');

  const defaultPath = String(payload.defaultPath || 'document.pdf').replace(/[\r\n]/g, '').trim() || 'document.pdf';
  const parentWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getFocusedWindow();
  const saveResult = await dialog.showSaveDialog(parentWindow || undefined, {
    title: 'Export rendered HTML as PDF',
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

  const pdfWindow = new BrowserWindow({
    show: false,
    width: Number(payload.width) || 1200,
    height: Number(payload.height) || 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  let tempDir = null;
  try {
    const documentHtml = ensureHtmlDocument(html, payload.baseUrl || '');
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodevision-pdf-'));
    const tempHtmlPath = path.join(tempDir, 'document.html');
    await fs.writeFile(tempHtmlPath, documentHtml, 'utf8');
    await pdfWindow.loadFile(tempHtmlPath);
    await waitForPrintableContent(pdfWindow);
    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      marginsType: 0,
      pageSize: payload.pageSize || 'Letter',
    });
    await fs.writeFile(saveResult.filePath, pdfBuffer);
    return { canceled: false, filePath: saveResult.filePath };
  } finally {
    if (!pdfWindow.isDestroyed()) pdfWindow.destroy();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export function setupElectronHandlers() {
  ipcMain.handle('nodevision:export-html-to-pdf', exportHtmlToPdf);

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

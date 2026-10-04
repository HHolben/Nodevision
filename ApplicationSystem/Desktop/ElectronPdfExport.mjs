// Nodevision/ApplicationSystem/Desktop/ElectronPdfExport.mjs
// This module exports rendered HTML to PDF through an isolated Electron window, waiting for printable resources and releasing temporary files and the window after each export.
import { BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

// Prepare a complete document and wait for its fonts, images, and layout.
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

// Resolve the current parent window for each request and own export cleanup.
export function createElectronPdfExporter(getMainWindow) {
  return async function exportHtmlToPdf(_event, payload = {}) {
    const mainWindow = getMainWindow();
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
  };
}

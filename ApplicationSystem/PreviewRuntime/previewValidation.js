// Nodevision/ApplicationSystem/PreviewRuntime/previewValidation.js
// This file defines the preview Validation module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
import path from 'node:path';
import { normalizeLanguage, isSupportedExtensionForLanguage } from './previewTypes.js';

export function assertPlainObject(value, name = 'value') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

export function clampTimeoutMs(timeoutMs, limits) {
  const fallback = limits.timeoutMsDefault;
  const max = limits.timeoutMsMax;
  const n = Number(timeoutMs);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(1, Math.floor(n)), max);
}

export function validateArgs(args, limits) {
  if (args == null) return [];
  if (!Array.isArray(args)) throw new Error('args must be an array of strings');
  if (args.length > limits.argsMaxCount) throw new Error(`args too long (max ${limits.argsMaxCount})`);
  const out = [];
  for (const arg of args) {
    if (typeof arg !== 'string') throw new Error('args must be an array of strings');
    const buf = Buffer.from(arg, 'utf8');
    if (buf.length > limits.argMaxBytes) throw new Error(`arg too long (max ${limits.argMaxBytes} bytes)`);
    out.push(arg);
  }
  return out;
}

export function validateStdin(stdin, limits) {
  if (stdin == null) return '';
  if (typeof stdin !== 'string') throw new Error('stdin must be a string');
  const bytes = Buffer.from(stdin, 'utf8').length;
  if (bytes > limits.stdinMaxBytes) throw new Error(`stdin too large (max ${limits.stdinMaxBytes} bytes)`);
  return stdin;
}

export function validateLanguage(language) {
  const normalized = normalizeLanguage(language);
  if (!normalized) throw new Error('unsupported language');
  return normalized;
}

export function validateSourceDescriptor(source, language, limits) {
  assertPlainObject(source, 'source');
  const filePath = typeof source.filePath === 'string' ? source.filePath : (typeof source.path === 'string' ? source.path : 'Notebook/Unknown');
  const normalizedPath = filePath.replace(/\0/g, '').replace(/\\/g, '/');
  if (!normalizedPath.startsWith('Notebook/')) {
    throw new Error('source.filePath must be under Notebook/');
  }
  if (normalizedPath.split('/').some((p) => p === '..')) {
    throw new Error('invalid source.filePath');
  }
  const fileName = path.posix.basename(normalizedPath);
  if (!fileName || fileName === '.' || fileName === '..') {
    throw new Error('source.filePath must include a file name');
  }
  if (fileName.includes('\0')) throw new Error('invalid file name');
  const ext = path.extname(fileName).toLowerCase();
  if (!isSupportedExtensionForLanguage(ext, language)) {
    throw new Error(`unsupported extension ${ext} for language ${language}`);
  }
  const content = source.content;
  if (typeof content !== 'string') throw new Error('source.content must be a string');
  const contentBytes = Buffer.from(content, 'utf8').length;
  if (contentBytes > limits.sourceMaxBytes) throw new Error(`source too large (max ${limits.sourceMaxBytes} bytes)`);
  return { filePath, fileName, ext, content };
}

export function normalizePreviewJobRequest(body, config) {
  assertPlainObject(body, 'request body');
  const language = validateLanguage(body.language);
  const timeoutMs = clampTimeoutMs(body.timeoutMs, { timeoutMsDefault: config.timeoutMs, timeoutMsMax: config.timeoutMs });
  const source = validateSourceDescriptor(body.source, language, { sourceMaxBytes: config.sourceLimit });
  return { language, timeoutMs, source };
}

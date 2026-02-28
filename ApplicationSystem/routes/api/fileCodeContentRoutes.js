// routes/api/fileCodeContentRoutes.js
// Purpose: Read code/text files with basic encoding detection metadata.
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const NOTEBOOK_ROOT = path.join(ROOT_DIR, 'Notebook');
const router = express.Router();

function resolveNotebookPath(relativePath) {
  if (!relativePath) throw new Error("Missing path");

  let cleaned = String(relativePath).replace(/^\/+/, '');
  cleaned = path.normalize(cleaned);
  cleaned = cleaned.replace(/\.\.(\/|\\)/g, '');

  const nbPrefix = `Notebook${path.sep}`;
  if (cleaned.startsWith(nbPrefix)) cleaned = cleaned.slice(nbPrefix.length);
  return path.join(NOTEBOOK_ROOT, cleaned);
}

function looksBinary(buf) {
  if (!buf || buf.length === 0) return false;
  let suspicious = 0;
  const sampleLen = Math.min(buf.length, 4096);
  for (let i = 0; i < sampleLen; i += 1) {
    const b = buf[i];
    if (b === 0) return true;
    if (b < 7 || (b > 14 && b < 32)) suspicious += 1;
  }
  return suspicious / sampleLen > 0.2;
}

function decodeWithDetectedEncoding(buf) {
  if (!buf || buf.length === 0) {
    return { content: "", encoding: "utf8", bom: false, isBinary: false };
  }

  // UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return {
      content: buf.slice(3).toString("utf8"),
      encoding: "utf8",
      bom: true,
      isBinary: false,
    };
  }

  // UTF-16 BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return {
      content: buf.slice(2).toString("utf16le"),
      encoding: "utf16le",
      bom: true,
      isBinary: false,
    };
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const data = Buffer.from(buf.slice(2));
    data.swap16();
    return {
      content: data.toString("utf16le"),
      encoding: "utf16be",
      bom: true,
      isBinary: false,
    };
  }

  // Strict UTF-8 check first
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return { content: text, encoding: "utf8", bom: false, isBinary: false };
  } catch {
    // fall through
  }

  // Fallback for legacy single-byte text files
  if (!looksBinary(buf)) {
    return { content: buf.toString("latin1"), encoding: "latin1", bom: false, isBinary: false };
  }

  // Last-resort decode to keep editor from crashing.
  return {
    content: buf.toString("latin1"),
    encoding: "latin1",
    bom: false,
    isBinary: true,
  };
}

router.get('/fileCodeContent', async (req, res) => {
  const relativePath = req.query.path;
  if (!relativePath) return res.status(400).json({ error: 'File path is required' });

  let absolutePath;
  try {
    absolutePath = resolveNotebookPath(relativePath);
  } catch {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  try {
    const buffer = await fs.readFile(absolutePath);
    const decoded = decodeWithDetectedEncoding(buffer);

    res.json({
      content: decoded.content,
      encoding: decoded.encoding,
      bom: decoded.bom,
      isBinary: decoded.isBinary,
    });
  } catch (err) {
    console.error('Error reading file:', err);
    res.status(500).json({ error: 'Error reading file' });
  }
});

export default router;

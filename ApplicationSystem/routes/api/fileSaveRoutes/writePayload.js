// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes/writePayload.js
// This file writes request payloads to disk with encoding and BOM support so that Nodevision can persist both text and binary notebook files correctly.

import fs from "node:fs/promises";
import path from "node:path";

async function writeFileAtomic(filePath, buffer) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath).replace(/[^\w.-]/g, "_") || "file";
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tempPath = path.join(dir, `.nodevision-save-${base}-${suffix}.tmp`);

  try {
    await fs.writeFile(tempPath, buffer, { flag: "wx" });
    await fs.rename(tempPath, filePath);
  } catch (err) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup failures; the original file was not replaced.
    }
    throw err;
  }
}

export async function writePayloadToFile({ filePath, content, encoding = "utf8", mimeType, bom = false, logPath = "" }) {
  const enc = String(encoding || "utf8").toLowerCase();

  if (enc === "base64") {
    const buffer = Buffer.from(content, "base64");
    await writeFileAtomic(filePath, buffer);
    console.log(`Saved binary file: ${logPath} (${mimeType || "unknown"})`);
    return;
  }

  if (enc === "binary") {
    const buffer = Buffer.from(content, "binary");
    await writeFileAtomic(filePath, buffer);
    console.log(`Saved raw binary: ${logPath}`);
    return;
  }

  if (enc === "utf8" || enc === "utf-8") {
    const textBuf = Buffer.from(content, "utf8");
    const out = bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), textBuf]) : textBuf;
    await writeFileAtomic(filePath, out);
    console.log(`Saved text file: ${logPath} (utf8${bom ? "+bom" : ""})`);
    return;
  }

  if (enc === "utf16le" || enc === "utf-16le") {
    const textBuf = Buffer.from(content, "utf16le");
    const out = bom ? Buffer.concat([Buffer.from([0xff, 0xfe]), textBuf]) : textBuf;
    await writeFileAtomic(filePath, out);
    console.log(`Saved text file: ${logPath} (utf16le${bom ? "+bom" : ""})`);
    return;
  }

  if (enc === "utf16be" || enc === "utf-16be") {
    const textBuf = Buffer.from(content, "utf16le");
    textBuf.swap16();
    const out = bom ? Buffer.concat([Buffer.from([0xfe, 0xff]), textBuf]) : textBuf;
    await writeFileAtomic(filePath, out);
    console.log(`Saved text file: ${logPath} (utf16be${bom ? "+bom" : ""})`);
    return;
  }

  if (enc === "latin1" || enc === "iso-8859-1") {
    const textBuf = Buffer.from(content, "latin1");
    await writeFileAtomic(filePath, textBuf);
    console.log(`Saved text file: ${logPath} (latin1)`);
    return;
  }

  const err = new Error(`Unsupported encoding: ${encoding}`);
  err.code = "UNSUPPORTED_ENCODING";
  throw err;
}


// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes/writePayload.js
// This file writes request payloads to disk with encoding and BOM support so that Nodevision can persist both text and binary notebook files correctly.

import fs from "node:fs/promises";

export async function writePayloadToFile({ filePath, content, encoding = "utf8", mimeType, bom = false, logPath = "" }) {
  const enc = String(encoding || "utf8").toLowerCase();

  if (enc === "base64") {
    const buffer = Buffer.from(content, "base64");
    await fs.writeFile(filePath, buffer);
    console.log(`Saved binary file: ${logPath} (${mimeType || "unknown"})`);
    return;
  }

  if (enc === "binary") {
    const buffer = Buffer.from(content, "binary");
    await fs.writeFile(filePath, buffer);
    console.log(`Saved raw binary: ${logPath}`);
    return;
  }

  if (enc === "utf8" || enc === "utf-8") {
    const textBuf = Buffer.from(content, "utf8");
    const out = bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), textBuf]) : textBuf;
    await fs.writeFile(filePath, out);
    console.log(`Saved text file: ${logPath} (utf8${bom ? "+bom" : ""})`);
    return;
  }

  if (enc === "utf16le" || enc === "utf-16le") {
    const textBuf = Buffer.from(content, "utf16le");
    const out = bom ? Buffer.concat([Buffer.from([0xff, 0xfe]), textBuf]) : textBuf;
    await fs.writeFile(filePath, out);
    console.log(`Saved text file: ${logPath} (utf16le${bom ? "+bom" : ""})`);
    return;
  }

  if (enc === "utf16be" || enc === "utf-16be") {
    const textBuf = Buffer.from(content, "utf16le");
    textBuf.swap16();
    const out = bom ? Buffer.concat([Buffer.from([0xfe, 0xff]), textBuf]) : textBuf;
    await fs.writeFile(filePath, out);
    console.log(`Saved text file: ${logPath} (utf16be${bom ? "+bom" : ""})`);
    return;
  }

  if (enc === "latin1" || enc === "iso-8859-1") {
    const textBuf = Buffer.from(content, "latin1");
    await fs.writeFile(filePath, textBuf);
    console.log(`Saved text file: ${logPath} (latin1)`);
    return;
  }

  const err = new Error(`Unsupported encoding: ${encoding}`);
  err.code = "UNSUPPORTED_ENCODING";
  throw err;
}


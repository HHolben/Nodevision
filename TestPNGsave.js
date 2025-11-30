// TestPNGsave.js
import fs from 'node:fs/promises';
import path from 'node:path';
import fetch from 'node-fetch';

async function uploadBase64(filePath, destPath) {
  try {
    // Read the file and encode to base64
    const buffer = await fs.readFile(filePath);
    const b64 = buffer.toString('base64');

    const res = await fetch("http://localhost:3000/api/file/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: destPath,        // where to save in Notebook
        content: b64,
        encoding: "base64",
        mimeType: "image/png"
      })
    });

    const json = await res.json();
    console.log("Server response:", json);

  } catch (err) {
    console.error("Upload failed:", err);
  }
}

// --- Usage ---
const localFile = path.resolve('Notebook/myImage.png');   // your local PNG
const notebookDest = 'test/myImage.png';         // destination in Notebook

uploadBase64(localFile, notebookDest);

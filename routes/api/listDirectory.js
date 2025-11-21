// Nodevision/routes/api/listDirectory.js
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTEBOOK_DIR = path.join(__dirname, "../../Notebook"); // adjust as needed
const router = express.Router();

/**
 * Normalize and resolve a project-relative id into a filesystem path.
 * Expects pathId like "Notebook/Dir/Sub"
 */
function resolvePathIdToFs(pathId) {
  // Prevent directory traversal
  const parts = pathId.split("/").filter(Boolean);
  // If the client passed "Notebook" root, treat as NOTEBOOK_DIR itself
  if (parts.length === 1 && parts[0] === "Notebook") {
    return NOTEBOOK_DIR;
  }
  // otherwise, join from NOTEBOOK_DIR plus the remainder under it
  const rel = parts.slice(1).join(path.sep);
  return path.join(NOTEBOOK_DIR, rel);
}

router.get("/listDirectory", async (req, res) => {
  try {
    const pathId = req.query.path;
    if (!pathId) {
      return res.status(400).json({ error: "Missing path parameter" });
    }
    console.log("[listDirectory] pathId:", pathId);

    const fsPath = resolvePathIdToFs(pathId);
    const entries = await fs.readdir(fsPath, { withFileTypes: true });
    const directories = [];
    const files = [];
    for (const e of entries) {
      if (e.isDirectory()) directories.push(e.name);
      else if (e.isFile()) {
        // only expose markdown/html/text files - you can customize this
        if (/\.(md|html|txt|json|js|css)$/i.test(e.name)) files.push(e.name);
      }
    }
    res.json({ directories, files });
  } catch (err) {
    console.error("[listDirectory] error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

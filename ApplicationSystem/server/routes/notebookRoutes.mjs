// Nodevision/ApplicationSystem/server/routes/notebookRoutes.mjs
// This file registers file-oriented notebook endpoints so that the client can browse directories and discover links within notebook content.

import path from "node:path";
import fsPromises from "node:fs/promises";

import { validateAndNormalizePath } from "../pathUtils.mjs";

export function registerNotebookRoutes(app, ctx) {
  const NOTEBOOK_DIR = ctx.notebookDir;

  app.get("/api/topLevelNodes", async (req, res) => {
    const entries = await fsPromises.readdir(NOTEBOOK_DIR);
    res.json(entries);
  });

  app.get("/api/list-directory", async (req, res) => {
    try {
      const relPath = req.query.path || "";
      const fullPath = validateAndNormalizePath(relPath, NOTEBOOK_DIR);
      const entries = await fsPromises.readdir(fullPath, { withFileTypes: true });
      const result = entries.map((entry) => ({
        name: entry.name,
        fileType: entry.isDirectory() ? "directory" : "file",
      }));
      res.json(result);
    } catch (err) {
      console.error("Failed to list directory:", err.message);
      res.status(403).json({ error: "Access denied or directory not found" });
    }
  });

  app.get("/api/list-links", async (req, res) => {
    try {
      const relPath = req.query.path || "";
      const dirFull = validateAndNormalizePath(relPath, NOTEBOOK_DIR);
      const entries = await fsPromises.readdir(dirFull, { withFileTypes: true });
      const links = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (![".md", ".txt", ".html", ".js"].includes(ext)) continue;

        const content = await fsPromises.readFile(path.join(dirFull, entry.name), "utf8");
        const regex = /\[\[([^\]]+)\]\]|\[.*?\]\((.*?)\)/g;
        let match;
        while ((match = regex.exec(content))) {
          const target = match[1] || match[2];
          if (target) links.push({ source: entry.name, target });
        }
      }

      res.json(links);
    } catch (err) {
      console.error("Failed to list links:", err.message);
      res.status(403).json({ error: "Access denied or directory not found" });
    }
  });
}


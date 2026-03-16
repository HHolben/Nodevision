// Nodevision/ApplicationSystem/server/routes/worldRoutes.mjs
// This file registers endpoints that extract virtual world definitions from notebook HTML so that the client can load and render saved worlds.

import fsPromises from "node:fs/promises";
import * as cheerio from "cheerio";

import { validateAndNormalizePath } from "../pathUtils.mjs";

export function registerWorldRoutes(app, ctx) {
  const NOTEBOOK_DIR = ctx.notebookDir;

  app.post("/api/load-world", async (req, res) => {
    let { worldPath } = req.body;
    if (!worldPath) {
      return res.status(400).json({ error: "No world path provided" });
    }

    try {
      worldPath = String(worldPath)
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/^\.\//, "")
        .replace(/^Notebook\//, "");

      const filePath = validateAndNormalizePath(worldPath, NOTEBOOK_DIR);
      const fileContent = await fsPromises.readFile(filePath, "utf8");
      const $ = cheerio.load(fileContent);
      const worldScript = $('script[type="application/json"]').html();
      if (!worldScript) {
        return res.status(400).json({ error: "No world definition found in file" });
      }

      const cleaned = String(worldScript)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
        .trim();

      res.json({ worldDefinition: JSON.parse(cleaned) });
    } catch (error) {
      res.status(500).json({ error: "Error loading world", details: error?.message || "Unknown error" });
    }
  });
}

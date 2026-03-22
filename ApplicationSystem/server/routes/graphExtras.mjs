// Nodevision/ApplicationSystem/server/routes/graphExtras.mjs
// This file registers graph utility endpoints so that the client can persist derived edge data into shared storage safely.

import path from "node:path";
import fsPromises from "node:fs/promises";

export function registerGraphExtras(app, ctx) {
  const SHARED_DATA_DIR = ctx.sharedDataDir;

  function edgeKey(edge) {
    return `${edge?.source || ""}→${edge?.target || ""}`;
  }

  async function readJsonArray(filePath) {
    try {
      const raw = await fsPromises.readFile(filePath, "utf8");
      const trimmed = raw.trim();
      if (!trimmed) return [];
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if (err?.code === "ENOENT") return [];
      throw err;
    }
  }

  app.post("/api/graph/save-edges", async (req, res) => {
    try {
      const { filename, data } = req.body;
      if (!filename || typeof filename !== "string") {
        return res.status(400).json({ error: "filename is required" });
      }
      if (typeof data !== "object") {
        return res.status(400).json({ error: "data must be a JSON object" });
      }

      let char = filename.trim()[0];
      if (!char) char = "#";
      if (!/^[A-Za-z0-9]$/.test(char)) char = "#";

      const edgesDir = path.join(SHARED_DATA_DIR, "edges");
      const targetFile = path.join(edgesDir, `${char}.json`);
      await fsPromises.mkdir(edgesDir, { recursive: true });

      // Merge with existing data to avoid clients clobbering the shard.
      const existingEdges = await readJsonArray(targetFile);
      const incomingEdges = Array.isArray(data) ? data : [];
      const combined = [...existingEdges, ...incomingEdges].filter((edge) => {
        return edge && typeof edge === "object" && typeof edge.source === "string" && typeof edge.target === "string";
      });
      const seen = new Set();
      const deduped = [];
      for (const edge of combined) {
        const key = edgeKey(edge);
        if (!edge.source || !edge.target) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(edge);
      }

      const tmpFile = `${targetFile}.tmp`;
      await fsPromises.writeFile(tmpFile, JSON.stringify(deduped, null, 2), "utf8");
      await fsPromises.rename(tmpFile, targetFile);

      res.json({
        success: true,
        bucket: char,
        path: `public/data/edges/${char}.json`,
      });
    } catch (err) {
      console.error("Failed to save edge bucket:", err);
      res.status(500).json({ error: "Failed to save edge data" });
    }
  });
}

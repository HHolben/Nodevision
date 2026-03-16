// Nodevision/ApplicationSystem/server/routes/graphExtras.mjs
// This file registers graph utility endpoints so that the client can persist derived edge data into shared storage safely.

import path from "node:path";
import fsPromises from "node:fs/promises";

export function registerGraphExtras(app, ctx) {
  const SHARED_DATA_DIR = ctx.sharedDataDir;

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
      const tmpFile = `${targetFile}.tmp`;
      await fsPromises.writeFile(tmpFile, JSON.stringify(data, null, 2), "utf8");
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


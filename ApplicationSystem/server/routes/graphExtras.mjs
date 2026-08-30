// Nodevision/ApplicationSystem/server/routes/graphExtras.mjs
// This file registers graph utility endpoints so that the client can persist derived edge data into shared storage safely.

import path from "node:path";
import {
  computeEdgeBucketChar,
  dedupeEdges,
  readEdgeBucket,
  writeEdgeBucket,
} from "../../shared/graphEdgeBucketUtils.mjs";

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

      const char = computeEdgeBucketChar(filename);

      const edgesDir = path.join(SHARED_DATA_DIR, "edges");
      const targetFile = path.join(edgesDir, `${char}.json`);

      // Merge with existing data to avoid clients clobbering the shard.
      const warnings = [];
      const existingEdges = await readEdgeBucket(targetFile, { repair: true, warnings });
      const incomingEdges = Array.isArray(data) ? data : [];
      const deduped = dedupeEdges([...existingEdges, ...incomingEdges]);

      await writeEdgeBucket(targetFile, deduped);

      res.json({
        success: true,
        bucket: char,
        path: `public/data/edges/${char}.json`,
        warnings,
      });
    } catch (err) {
      console.error("Failed to save edge bucket:", err);
      res.status(500).json({
        error: "Failed to save edge data",
        details: err?.message || "Unknown graph save error.",
      });
    }
  });
}

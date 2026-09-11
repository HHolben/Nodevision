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

  function groupEdgesByBucket(edges = [], edgeKey = "target", fallbackFilename = "") {
    const groups = new Map();
    for (const edge of Array.isArray(edges) ? edges : []) {
      if (!edge || typeof edge !== "object" || !edge.source || !edge.target) continue;
      const pathValue = edgeKey === "source" ? edge.source : edge.target;
      const fileName = String(pathValue).split("/").pop() || fallbackFilename || "unknown";
      const char = computeEdgeBucketChar(fileName);
      const bucketEdges = groups.get(char) || [];
      bucketEdges.push(edge);
      groups.set(char, bucketEdges);
    }
    return groups;
  }

  async function writeGroupedBuckets(baseDir, groupedEdges, warnings) {
    const results = [];
    for (const [char, bucketEdges] of groupedEdges.entries()) {
      const targetFile = path.join(baseDir, `${char}.json`);
      const existingEdges = await readEdgeBucket(targetFile, { repair: true, warnings });
      const deduped = dedupeEdges([...existingEdges, ...bucketEdges]);
      await writeEdgeBucket(targetFile, deduped);
      results.push({
        bucket: char,
        path: "public/data/edges/" + path.relative(path.join(SHARED_DATA_DIR, "edges"), targetFile).split(path.sep).join("/"),
        edgeCount: bucketEdges.length,
        storedEdgeCount: deduped.length,
      });
    }
    return results;
  }

  app.post("/api/graph/save-edges", async (req, res) => {
    try {
      const { filename = "", data } = req.body;
      if (typeof data !== "object") {
        return res.status(400).json({ error: "data must be a JSON object" });
      }

      const incomingEdges = Array.isArray(data) ? data : [];
      const targetGroups = groupEdgesByBucket(incomingEdges, "target", filename);
      if (!targetGroups.size) {
        return res.json({ success: true, edgeCount: 0, bucketCount: 0, sourceBucketCount: 0, results: [], sourceResults: [] });
      }

      const edgesDir = path.join(SHARED_DATA_DIR, "edges");
      const sourceEdgesDir = path.join(edgesDir, "by-source");
      const warnings = [];
      const results = await writeGroupedBuckets(edgesDir, targetGroups, warnings);
      const sourceResults = await writeGroupedBuckets(sourceEdgesDir, groupEdgesByBucket(incomingEdges, "source", filename), warnings);

      res.json({
        success: true,
        edgeCount: incomingEdges.length,
        bucketCount: results.length,
        sourceBucketCount: sourceResults.length,
        bucket: results[0]?.bucket,
        path: results[0]?.path,
        results,
        sourceResults,
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

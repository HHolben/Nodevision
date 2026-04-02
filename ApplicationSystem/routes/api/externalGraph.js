// Nodevision/ApplicationSystem/routes/api/externalGraph.js
// API endpoints for external (non-notebook) graph nodes, e.g., websites.

import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createServerContext } from "../../shared/serverContext.mjs";

const BASE_CONTEXT = createServerContext();

function paths(ctx) {
  const graphDir = path.join(ctx.userDataDir, "graph");
  return {
    graphDir,
    nodesPath: path.join(graphDir, "external-nodes.json"),
  };
}

async function ensureGraphDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readExternalNodes(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

function sanitizeNodes(nodes) {
  const unique = new Map();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== "object") continue;
    const id = typeof node.id === "string" && node.id.trim() ? node.id.trim() : null;
    const label = typeof node.label === "string" && node.label.trim() ? node.label.trim() : id;
    const url = typeof node.url === "string" && node.url.trim() ? node.url.trim() : null;
    if (!id || !label || !url) continue;

    unique.set(id, {
      id,
      label,
      url,
      type: node.type || "external-web",
      category: node.category || "website",
      description: node.description || "",
      createdAt: node.createdAt || "",
      source: node.source || "",
    });
  }
  return [...unique.values()];
}

export default function createExternalGraphRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const { graphDir, nodesPath } = paths(ctx);

  router.get("/external/nodes", async (_req, res) => {
    try {
      await ensureGraphDir(graphDir);
      const rawNodes = await readExternalNodes(nodesPath);
      const nodes = sanitizeNodes(rawNodes);
      return res.json(nodes);
    } catch (err) {
      console.error("[externalGraph] Failed to load external nodes:", err);
      return res.status(500).json({ error: "Failed to load external nodes" });
    }
  });

  router.post("/external/nodes", async (req, res) => {
    try {
      const incoming = Array.isArray(req.body) ? req.body : req.body?.nodes;
      if (!Array.isArray(incoming)) {
        return res.status(400).json({ error: "Payload must be an array of nodes or { nodes }" });
      }

      await ensureGraphDir(graphDir);
      const existing = sanitizeNodes(await readExternalNodes(nodesPath));
      const merged = sanitizeNodes([...existing, ...incoming]);

      await fs.writeFile(nodesPath, JSON.stringify(merged, null, 2), "utf8");
      return res.json({ success: true, count: merged.length });
    } catch (err) {
      console.error("[externalGraph] Failed to save external nodes:", err);
      return res.status(500).json({ error: "Failed to save external nodes" });
    }
  });

  return router;
}

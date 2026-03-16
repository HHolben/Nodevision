// Nodevision/ApplicationSystem/routes/api/toolbarRoutes.js
// This file defines the toolbar Routes API route handler for the Nodevision server. It validates requests and sends responses for toolbar Routes operations.
// routes/api/toolbarRoutes.js
// This file creates a backend manifest of toolbar JSON files

import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createToolbarRouter(ctx = BASE_CONTEXT) {
  const toolbarDir = path.join(ctx.publicDir, "ToolbarJSONfiles");
  const router = express.Router();

  router.get("/manifest", async (req, res) => {
    try {
      const entries = await fs.readdir(toolbarDir, { withFileTypes: true });
      const jsonFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name);

      res.json(jsonFiles);
    } catch (err) {
      console.error("Error reading ToolbarJSONfiles directory:", err);
      res.status(500).json({ error: "Failed to read toolbar JSON directory" });
    }
  });

  return router;
}

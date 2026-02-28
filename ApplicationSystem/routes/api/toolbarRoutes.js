// routes/api/toolbarRoutes.js
// This file is used to create a backend that creates a manifest of toolbar JSON files

import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Base directory for toolbar JSON files
const toolbarDir = path.resolve(__dirname, "../../public/ToolbarJSONfiles");

// Endpoint: GET /api/toolbar/manifest
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

export default router;

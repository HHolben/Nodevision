// Nodevision/ApplicationSystem/routes/api/saveData.js
// Declares endpoint for saving edge data

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createSaveDataRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const dataDir = ctx.sharedDataDir;

  fs.mkdir(dataDir, { recursive: true }).catch((err) => {
    console.error("Error creating data directory:", err);
  });

  router.post('/files/save-data', async (req, res) => {
    try {
      const { filename, content } = req.body;

      if (!filename) {
        return res.status(400).json({ error: "Missing filename" });
      }

      const safeFilename = path.basename(filename);
      const filePath = path.join(dataDir, safeFilename);

      await fs.writeFile(filePath, content, 'utf8');
      res.json({ success: true, saved: safeFilename });
    } catch (err) {
      console.error("save-data error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

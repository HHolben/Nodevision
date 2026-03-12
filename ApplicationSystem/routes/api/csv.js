// routes/api/csv.js
// CSV file append endpoint

import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createObjectCsvWriter } from 'csv-writer';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createCsvRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const NOTEBOOK_DIR = ctx.notebookDir;

  router.post('/add-csv-entry', async (req, res) => {
    const { filename, data } = req.body;

    if (!filename || !data || !Array.isArray(data)) {
      return res.status(400).json({ error: "Invalid request. Provide 'filename' and 'data' as an array." });
    }

    const filePath = path.join(NOTEBOOK_DIR, filename);

    try {
      const headers = data.map((_, i) => ({ id: `col${i}`, title: `Column ${i + 1}` }));
      if (!await fileExists(filePath)) {
        await fs.writeFile(filePath, headers.map(h => h.title).join(",") + "\n", 'utf8');
      }

      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: headers,
        append: true
      });

      await csvWriter.writeRecords([Object.fromEntries(data.map((value, i) => [`col${i}`, value]))]);
      res.json({ message: "Data appended successfully!" });
    } catch (error) {
      console.error("Error writing to CSV:", error);
      res.status(500).json({ error: "Error writing to CSV file." });
    }
  });

  async function fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  return router;
}

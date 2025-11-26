//Nodevision/routes/api/saveData.js
//This file declars an endpoint for saving edge data
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

const router = express.Router();
const dataDir = path.join(process.cwd(), 'public/data');

// Ensure directory exists
fs.mkdir(dataDir, { recursive: true }).catch(err => {
  console.error("Error creating data directory:", err);
});

router.post('/files/save-data', async (req, res) => {
  try {
    const { filename, content } = req.body;

    if (!filename) {
      return res.status(400).json({ error: "Missing filename" });
    }

    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(dataDir, safeFilename);

    await fs.writeFile(filePath, content, 'utf8');

    res.json({ success: true, saved: safeFilename });
  } catch (err) {
    console.error("save-data error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

// Nodevision/routes/api/downloadFile.js
// Purpose: TODO: Add description of module purpose
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const NOTEBOOK_DIR = path.join(ROOT_DIR, 'Notebook');

const router = express.Router();

router.get('/download', (req, res) => {
  const filePath = req.query.path;
  console.log("The user is downloading file" + filePath)

  
  if (!filePath) return res.status(400).send("Missing 'path' parameter");

  const fullPath = path.join(NOTEBOOK_DIR, filePath);

  fs.access(fullPath, fs.constants.R_OK, (err) => {
    if (err) return res.status(404).send("File not found");

    res.download(fullPath, path.basename(fullPath), (err) => {
      if (err) console.error("Error sending file:", err);
    });
  });
});

export default router;

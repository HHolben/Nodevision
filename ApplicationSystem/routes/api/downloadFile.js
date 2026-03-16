// Nodevision/ApplicationSystem/routes/api/downloadFile.js
// This file defines the download File API route handler for the Nodevision server. It validates requests and sends responses for download File operations.

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createDownloadFileRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const NOTEBOOK_DIR = ctx.notebookDir;

  router.get('/download', (req, res) => {
    const filePath = req.query.path;
    console.log("The user is downloading file" + filePath);

    if (!filePath) return res.status(400).send("Missing 'path' parameter");
    const fullPath = path.join(NOTEBOOK_DIR, filePath);

    fs.access(fullPath, fs.constants.R_OK, (err) => {
      if (err) return res.status(404).send("File not found");

      res.download(fullPath, path.basename(fullPath), (downloadErr) => {
        if (downloadErr) console.error("Error sending file:", downloadErr);
      });
    });
  });

  return router;
}

// routes/api/uploadImage.js
// Purpose: Image upload and file handling operations

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createUploadImageRouter(ctx = BASE_CONTEXT) {
  const NOTEBOOK_DIR = ctx.notebookDir;
  const router = express.Router();

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, NOTEBOOK_DIR);
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });
  const upload = multer({ storage });

  router.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const filePath = `/Notebook/${path.basename(req.file.filename)}`;
    res.json({ success: true, message: 'Image uploaded successfully', filePath });
  });

  return router;
}

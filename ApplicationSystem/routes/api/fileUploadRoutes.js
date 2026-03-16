// Nodevision/ApplicationSystem/routes/api/fileUploadRoutes.js
// This file defines the file Upload Routes API route handler for the Nodevision server. It validates requests and sends responses for file Upload Routes operations.
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Save to Notebook directly
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'Notebook')),
  filename: (req, file, cb) => cb(null, file.originalname)
});

const upload = multer({ storage });

router.post('/upload-binary', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, filename: req.file.originalname });
});

export default router;

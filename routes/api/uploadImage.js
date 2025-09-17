// routes/api/uploadImage.js
// Purpose: Image upload and file handling operations

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Storage settings for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../Notebook'));  // Save to 'Notebook' directory
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));  // Use unique filename
    }
});
const upload = multer({ storage: storage });

router.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const filePath = `/Notebook/${req.file.filename}`;  // Return path for serving
    res.json({ success: true, message: 'Image uploaded successfully', filePath });
});

export default router;

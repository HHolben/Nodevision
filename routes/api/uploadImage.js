const express = require('express');
const multer = require('multer');
const path = require('path');
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

module.exports = router;

// routes/api/fileSaveRoutes.js
const express = require('express');
const fs = require('fs').promises; // For async operations
const router = express.Router();

// Endpoint to save file content
router.post('/save', async (req, res) => {
    const { path: filePath, content } = req.body;

    if (!filePath || !content) {
        return res.status(400).send('File path and content are required');
    }

    try {
        await fs.writeFile(filePath, content, 'utf8');
        res.send('File saved successfully');
    } catch (err) {
        res.status(500).send('Error saving file');
    }
});

module.exports = router;

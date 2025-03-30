// routes/api/fileCodeContentRoutes.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Ensure the path is correctly resolved relative to the project root
const notebookBasePath = path.resolve(__dirname, '../..');


// Endpoint to get file content
router.get('/fileCodeContent', async (req, res) => {
    const filePath = req.query.path;
    console.log('Requested file path:', filePath);

    if (!filePath) {
        return res.status(400).send('File path is required');
    }

    const absolutePath = path.join(notebookBasePath, filePath);

    try {
        const data = await fs.readFile(absolutePath, 'utf8');
        res.send({ content: data });
    } catch (err) {
        console.error('Error reading file:', err);
        res.status(500).send('Error reading file');
    }
});

module.exports = router;

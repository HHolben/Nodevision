const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

router.get('/api/search', async (req, res) => {
    const searchQuery = req.query.q.toLowerCase();  // Get the search query from the client

    try {
        const files = await fs.readdir(path.join(__dirname, '../../Notebook'));
        const matchedFiles = files.filter(file => file.toLowerCase().includes(searchQuery));
        res.json({ files: matchedFiles });
    } catch (error) {
        console.error('Error reading files from Notebook directory:', error);
        res.status(500).send('Error searching for files');
    }
});

module.exports = router;

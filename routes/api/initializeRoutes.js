// routes/api/initializeRoutes.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Endpoint to initialize HTML file and regenerate graph
router.post('/initialize', async (req, res) => {
    const { htmlContent, fileName } = req.body;

    if (!htmlContent || !fileName) {
        return res.status(400).send('HTML content and file name are required.');
    }

    const filePath = path.join(__dirname, '../../Notebook', fileName);

    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, htmlContent);
        console.log(`HTML file "${filePath}" created successfully!`);
        res.status(200).send('HTML file created successfully.');
    } catch (error) {
        console.error('Error creating HTML file:', error);
        res.status(500).send('Error creating HTML file.');
    }
});

module.exports = router;

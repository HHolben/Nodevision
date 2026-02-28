// routes/api.js
// Purpose: TODO: Add description of module purpose

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Create a new folder
router.post('/create-folder', (req, res) => {
    const { folderName } = req.body;
    const folderPath = path.join(__dirname, 'yourDirectoryName', folderName);
    console.log('Folder will be created at:', folderPath);
    fs.mkdirSync(folderPath, { recursive: true });
    
    if (!folderName) return res.status(400).json({ error: 'Folder name is required' });

    fs.mkdir(folderPath, { recursive: true }, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Folder created successfully' });
    });




    
});


// Retrieve contents of a folder
router.get('/folder/:folderName', (req, res) => {
    const { folderName } = req.params;
    const folderPath = path.join(__dirname, '../Notebook', folderName);

    fs.readdir(folderPath, (err, files) => {
        if (err) return res.status(404).json({ error: 'Folder not found' });
        res.status(200).json({ files });
    });
});

// Delete a folder
router.delete('/folder/:folderName', (req, res) => {
    const { folderName } = req.params;
    const folderPath = path.join(__dirname, '../Notebook', folderName);

    fs.rm(folderPath, { recursive: true, force: true }, (err) => {
        if (err) return res.status(404).json({ error: 'Folder not found' });
        res.status(200).json({ message: 'Folder deleted successfully' });
    });
});

module.exports = router;

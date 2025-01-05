const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

router.post('/updateGraphStyles', async (req, res) => {
    const newStyles = req.body.styles;
    const stylesFilePath = path.join(__dirname, '../../public', 'GraphStyles.js');

    try {
        let currentStyles = await fs.readFile(stylesFilePath, 'utf8');
        currentStyles = currentStyles.replace(/background-color: #66ccff;/g, newStyles);
        await fs.writeFile(stylesFilePath, currentStyles, 'utf8');
        res.status(200).send('Graph styles updated successfully.');
    } catch (error) {
        console.error('Error updating GraphStyles.js:', error);
        res.status(500).send('Failed to update graph styles.');
    }
});

module.exports = router;

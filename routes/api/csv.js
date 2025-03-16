const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { createObjectCsvWriter } = require('csv-writer');

const router = express.Router();

router.post('/add-csv-entry', async (req, res) => {
    const { filename, data } = req.body;

    if (!filename || !data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid request. Provide 'filename' and 'data' as an array." });
    }

    const filePath = path.join(__dirname, '../../Notebook', filename);

    try {
        // Check if file exists, if not create with headers
        let headers = data.map((_, i) => ({ id: `col${i}`, title: `Column ${i + 1}` }));

        if (!await fileExists(filePath)) {
            await fs.writeFile(filePath, headers.map(h => h.title).join(",") + "\n", 'utf8');
        }

        const csvWriter = createObjectCsvWriter({
            path: filePath,
            header: headers,
            append: true
        });

        await csvWriter.writeRecords([Object.fromEntries(data.map((value, i) => [`col${i}`, value]))]);

        res.json({ message: "Data appended successfully!" });
    } catch (error) {
        console.error("Error writing to CSV:", error);
        res.status(500).json({ error: "Error writing to CSV file." });
    }
});

// Helper function to check if file exists
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

module.exports = router;

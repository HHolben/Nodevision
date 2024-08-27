
// Endpoint to handle updates to GraphStyles.js
app.post('/updateGraphStyles', express.json(), async (req, res) => {
    const newStyles = req.body.styles; // Assuming the request body contains new styles
    const stylesFilePath = path.join(__dirname, 'public', 'GraphStyles.js');

    try {
        // Read current styles file
        let currentStyles = await fs.readFile(stylesFilePath, 'utf8');

        // Modify styles as needed (example: replace all occurrences of a specific style property)
        // Example: replace all occurrences of 'background-color: #66ccff;' with new style
        currentStyles = currentStyles.replace(/background-color: #66ccff;/g, newStyles);

        // Write modified styles back to file
        await fs.writeFile(stylesFilePath, currentStyles, 'utf8');

        res.status(200).send('Graph styles updated successfully.');
    } catch (error) {
        console.error('Error updating GraphStyles.js:', error);
        res.status(500).send('Failed to update graph styles.');
    }
});
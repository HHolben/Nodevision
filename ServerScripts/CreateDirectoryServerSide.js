module.exports = (app, path, fs) => {
// New endpoint for creating a directory and adding a new region to the graph
app.post('/createDirectory', async (req, res) => {
    const { directoryName } = req.body;

    if (!directoryName) {
        return res.status(400).json({ message: 'Directory name is required.' });
    }

    const dirPath = path.join(__dirname, 'Notebook', directoryName);

    try {
        // Create the directory
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Directory created: ${dirPath}`);

        // Regenerate the graph with the new directory
        await runScript('RegenerateGraph.js');
        res.status(200).json({ message: 'Directory created and graph updated.' });
    } catch (error) {
        console.error('Error creating directory:', error);
        res.status(500).json({ message: 'Failed to create directory.' });
    }
});
};

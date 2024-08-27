// Search API endpoint
app.get('/api/search', async (req, res) => {
    const searchQuery = req.query.q.toLowerCase();  // Get the search query from the client

    try {
        // Read the list of files in the Notebook directory
        const files = await fs.readdir(notebookDir);

        // Filter files that match the search query (case-insensitive)
        const matchedFiles = files.filter(file => file.toLowerCase().includes(searchQuery));

        // Return the matching files
        res.json({ files: matchedFiles });
    } catch (error) {
        console.error('Error reading files from Notebook directory:', error);
        res.status(500).send('Error searching for files');
    }
});


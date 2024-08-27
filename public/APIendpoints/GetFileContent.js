

// Endpoint to get file content
app.get('/api/file', (req, res) => {
    const filePath = req.query.path;
    if (!filePath) {
        return res.status(400).send('File path is required');
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading file');
        }
        res.send({ content: data });
    });
});
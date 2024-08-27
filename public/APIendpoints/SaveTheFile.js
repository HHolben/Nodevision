

// Endpoint to save file content
app.post('/api/save', (req, res) => {
    const filePath = req.body.path;
    const content = req.body.content;

    if (!filePath || !content) {
        return res.status(400).send('File path and content are required');
    }

    fs.writeFile(filePath, content, 'utf8', (err) => {
        if (err) {
            return res.status(500).send('Error saving file');
        }
        res.send('File saved successfully');
    });
});

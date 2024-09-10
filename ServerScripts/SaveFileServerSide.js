module.exports = (app, path, fs) => {
    app.post('/api/save', async (req, res) => {
    const { path: filePath, content } = req.body;

    if (!filePath || !content) {
        return res.status(400).send('File path and content are required');
    }

    try {
        await fs.writeFile(filePath, content, 'utf8');
        res.send('File saved successfully');
    } catch (err) {
        res.status(500).send('Error saving file');
    }
});
};
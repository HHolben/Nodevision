module.exports = (app, path, fs) => {
    app.get('/api/file', async (req, res) => {
    const filePath = req.query.path;
    if (!filePath) {
        return res.status(400).send('File path is required');
    }

    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.send({ content: data });
    } catch (err) {
        res.status(500).send('Error reading file');
    }
});
};
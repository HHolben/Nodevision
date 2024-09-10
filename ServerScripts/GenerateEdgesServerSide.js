module.exports = (app, path, fs) => {
    app.post('/generateEdges', async (req, res) => {
    try {
        await generateEdges();
        res.status(200).send('Edges generated successfully');
    } catch (error) {
        console.error('Error generating edges:', error);
        res.status(500).send('Failed to generate edges');
    }
});
};
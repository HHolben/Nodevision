module.exports = (app, path, fs) => {
    app.post('/initialize', async (req, res) => {
    const { htmlContent, fileName } = req.body;
    const filePath = path.join(__dirname, 'Notebook', fileName);

    try {
        await fs.mkdir(path.join(__dirname, 'Notebook'), { recursive: true });
        await fs.writeFile(filePath, htmlContent);
        console.log(`HTML file "${filePath}" has been successfully created!`);
        await runScript('RegenerateGraph.js');
        res.send('HTML file has been created successfully and graph regenerated.');
    } catch (error) {
        console.error('Error writing HTML file:', error);
        res.status(500).send('Error creating HTML file');
    }
});
};
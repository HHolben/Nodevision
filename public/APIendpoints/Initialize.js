// Endpoint to handle requests from NewNotebookPageInitializer.js
app.post('/initialize', async (req, res) => {
    const { htmlContent } = req.body;
    const filePath = path.join(__dirname, 'Notebook', 'new-notebook-page.html');

    try {
        await fs.writeFile(filePath, htmlContent);
        console.log(`HTML file "${filePath}" has been successfully created!`);
        res.send('HTML file has been created successfully');
    } catch (error) {
        console.error('Error writing HTML file:', error);
        res.status(500).send('Error creating HTML file');
    }
});
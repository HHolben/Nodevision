const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const { exec } = require('child_process');

const app = express();
const port = 3000;

// Serve favicon
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));


app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function runScript(script) {
    return new Promise((resolve, reject) => {
        exec(`node ${script}`, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error running ${script}: ${stderr}`);
                reject(err);
                return;
            }
            console.log(`${script} output: ${stdout}`);
            resolve();
        });
    });
}

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

app.post('/updateGraphStyles', async (req, res) => {
    const newStyles = req.body.styles;
    const stylesFilePath = path.join(__dirname, 'public', 'GraphStyles.js');

    try {
        let currentStyles = await fs.readFile(stylesFilePath, 'utf8');
        currentStyles = currentStyles.replace(/background-color: #66ccff;/g, newStyles);
        await fs.writeFile(stylesFilePath, currentStyles, 'utf8');
        res.status(200).send('Graph styles updated successfully.');
    } catch (error) {
        console.error('Error updating GraphStyles.js:', error);
        res.status(500).send('Failed to update graph styles.');
    }
});

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

app.post('/api/save', async (req, res) => {
    const { path: filePath, content } = req.body;

    if (!filePath || !content)
    {
        return res.status(400).send('File path and content are required');
    }

    try
    {
        await fs.writeFile(filePath, content, 'utf8');
        res.send('File saved successfully');
    }
    catch (err) {
        res.status(500).send('Error saving file');
    }
});

const regenerateGraph = require('./RegenerateGraph');
app.use(regenerateGraph);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

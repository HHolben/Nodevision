const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs').promises; // Use fs.promises for async file operations
const { exec } = require('child_process'); // Import exec from child_process

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));


// Function to run a script and return a promise
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

// Endpoint to handle requests from NewNotebookPageInitializer.js
app.post('/initialize', async (req, res) => {
    const { htmlContent, fileName } = req.body;  // Expecting fileName from the request body
    const filePath = path.join(__dirname, 'Notebook', fileName);

    try {
        await fs.mkdir(path.join(__dirname, 'Notebook'), { recursive: true });  // Ensure the Notebook directory exists
        await fs.writeFile(filePath, htmlContent);
        console.log(`HTML file "${filePath}" has been successfully created!`);




        // Run RegenerateGraph.js after the new node is created
        await runScript('RegenerateGraph.js');

        res.send('HTML file has been created successfully and graph regenerated.');
    } catch (error) {
        console.error('Error writing HTML file:', error);
        res.status(500).send('Error creating HTML file');
    }
});

// Endpoint to handle updates to GraphStyles.js
app.post('/updateGraphStyles', express.json(), async (req, res) => {
    const newStyles = req.body.styles; // Assuming the request body contains new styles
    const stylesFilePath = path.join(__dirname, 'public', 'GraphStyles.js');

    try {
        // Read current styles file
        let currentStyles = await fs.readFile(stylesFilePath, 'utf8');

        // Modify styles as needed (example: replace all occurrences of a specific style property)
        // Example: replace all occurrences of 'background-color: #66ccff;' with new style
        currentStyles = currentStyles.replace(/background-color: #66ccff;/g, newStyles);

        // Write modified styles back to file
        await fs.writeFile(stylesFilePath, currentStyles, 'utf8');

        res.status(200).send('Graph styles updated successfully.');
    } catch (error) {
        console.error('Error updating GraphStyles.js:', error);
        res.status(500).send('Failed to update graph styles.');
    }
});



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


// Import RegenerateGraph.js to handle script execution and file serving
const regenerateGraph = require('./RegenerateGraph');
app.use(regenerateGraph);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();

// Function to run a script and return a promise
function runScript(scriptName) {
    try {
        // If the script is already loaded, call its corresponding function
        if (scriptName === 'NewNotebookPageInitializer.js' && window.initializeNewNotebookPage) {
            console.log('Running already-loaded script function.');
            window.initializeNewNotebookPage();
            return;
        }

        // Otherwise, load the script
        if (!document.querySelector(`script[src="${scriptName}"]`)) {
            const script = document.createElement('script');
            script.src = scriptName;
            script.onload = () => {
                if (window.initializeNewNotebookPage) {
                    window.initializeNewNotebookPage();
                }
            };
            document.body.appendChild(script);
        }
    } catch (error) {
        console.error(`Error running script ${scriptName}:`, error);
    }
}

// Run GenerateNodes.js, GenerateEdges.js, and GenerateRegions.js in sequence
(async () => {
    try {
        await runScript('GenerateNodes.js');
        await runScript('GenerateEdges.js');
        await runScript('GenerateRegions.js');
        console.log('All scripts ran successfully.');

        // Serve static files from the public directory with correct MIME types
        app.use(express.static('public'));

        // Ensure JavaScript files have the correct MIME type
        app.get('/GeneratedNodes.js', (req, res) => {
            res.type('application/javascript');
            res.sendFile(path.join(__dirname, 'public', 'GeneratedNodes.js'));
        });

        app.get('/GeneratedEdges.js', (req, res) => {
            res.type('application/javascript');
            res.sendFile(path.join(__dirname, 'public', 'GeneratedEdges.js'));
        });

        app.get('/GeneratedRegions.js', (req, res) => {
            res.type('application/javascript');
            res.sendFile(path.join(__dirname, 'public', 'GeneratedRegions.js'));
        });

        // Serve index.html
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });
    } catch (error) {
        console.error('Failed to run scripts:', error);
    }
})();

module.exports = app;

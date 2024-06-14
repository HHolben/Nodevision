const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs').promises; // Use fs.promises for async file operations

const app = express();
const port = 3000;

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

    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to run scripts:', error);
  }
})();

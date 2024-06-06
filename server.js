const express = require('express');
const path = require('path');
const { exec } = require('child_process');

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

    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to run scripts:', error);
  }
})();

const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.NODE_PORT || 3000;

const { writeNodesToFile } = require('./GenerateNodes');
const { writeEdgesToFile } = require('./GenerateEdges');
const { writeRegionsToFile } = require('./GenerateRegions');

// Initialize maximum display limits
let MaximumNodesDisplayed = 100;
let MaximumRegionsDisplayed = 100;
let MaximumEdgesDisplayed = 100;

// Allow CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// Define the directory name where your images are stored
const imageDirectory = 'Notebook';

// Serve static files from the specified directory
app.use('/images', express.static(path.join(__dirname, imageDirectory)));

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the Notebook directory
app.use('/Notebook', express.static(path.join(__dirname, 'Notebook')));

// Serve the main index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to handle creation of new files or directories
app.post('/create', (req, res) => {
  const { name, type } = req.body;
  const fullPath = path.join(__dirname, 'Notebook', name);

  if (type === 'file') {
    fs.writeFile(fullPath, '', (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to create file.' });
      }
      return res.status(200).json({ success: true, message: 'File created successfully.' });
    });
  } else if (type === 'directory') {
    fs.mkdir(fullPath, (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to create directory.' });
      }
      return res.status(200).json({ success: true, message: 'Directory created successfully.' });
    });
  } else {
    return res.status(400).json({ success: false, message: 'Invalid type.' });
  }
});

// Endpoint to set maximum nodes displayed
app.post('/set-max-nodes', (req, res) => {
  const { maxNodes } = req.body;
  if (typeof maxNodes === 'number' && maxNodes > 0) {
    MaximumNodesDisplayed = maxNodes;
    res.json({ message: 'Maximum nodes displayed value updated.' });
  } else {
    res.status(400).json({ message: 'Invalid value for maximum nodes.' });
  }
});

// Endpoint to set maximum regions displayed
app.post('/set-max-regions', (req, res) => {
  const { maxRegions } = req.body;
  if (typeof maxRegions === 'number' && maxRegions > 0) {
    MaximumRegionsDisplayed = maxRegions;
    res.json({ message: 'Maximum regions displayed value updated.' });
  } else {
    res.status(400).json({ message: 'Invalid value for maximum regions.' });
  }
});

// Endpoint to set maximum edges displayed
app.post('/set-max-edges', (req, res) => {
  const { maxEdges } = req.body;
  if (typeof maxEdges === 'number' && maxEdges > 0) {
    MaximumEdgesDisplayed = maxEdges;
    res.json({ message: 'Maximum edges displayed value updated.' });
  } else {
    res.status(400).json({ message: 'Invalid value for maximum edges.' });
  }
});

// Endpoint to regenerate files
app.post('/regenerate-files', (req, res) => {
  const notebookDir = path.join(__dirname, 'Notebook');
  const nodesOutputPath = path.join(__dirname, 'public', 'GeneratedNodes.js');
  const edgesOutputPath = path.join(__dirname, 'public', 'GeneratedEdges.js');
  const regionsOutputPath = path.join(__dirname, 'public', 'GeneratedRegions.js');

  try {
    writeNodesToFile(notebookDir, nodesOutputPath, MaximumNodesDisplayed);
    writeEdgesToFile(notebookDir, edgesOutputPath, validNodeIds, MaximumEdgesDisplayed);
    writeRegionsToFile(notebookDir, regionsOutputPath, MaximumRegionsDisplayed);
    res.json({ message: 'Files regenerated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error regenerating files.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

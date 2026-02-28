// src/server.js
// Purpose: TODO: Add description of module purpose

const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const ROOT_DIR = path.resolve(__dirname, '..');
const NOTEBOOK_DIR = path.join(ROOT_DIR, 'Notebook');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const port = config.nodePort;

app.use('/Notebook', express.static(NOTEBOOK_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Node server is running at http://localhost:${port}`);
});

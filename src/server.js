const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const port = config.nodePort;

app.use('/Notebook', express.static(path.join(__dirname, 'Notebook')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Node server is running at http://localhost:${port}`);
});

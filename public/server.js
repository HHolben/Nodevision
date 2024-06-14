const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.NODE_PORT || 3000;

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

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

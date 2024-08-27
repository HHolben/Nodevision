const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs').promises; // Use fs.promises for async file operations

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

require('./APIendpoints/GetFileContent')(app, path, fs);
require('./APIendpoints/Initialize')(app, path, fs);
require('./APIendpoints/SaveTheFile')(app, path, fs);
require('./APIendpoints/SearchForNotes')(app, path, fs);
require('./APIendpoints/UpdateGraphStyles')(app, path, fs);


// Import RegenerateGraph.js to handle script execution and file serving
const regenerateGraph = require('./RegenerateGraph');
app.use(regenerateGraph);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const syncFs = require('fs');
const { exec } = require('child_process');
const { generateEdges } = require('./GenerateEdges');
const { generateAllNodes } = require('./GenerateAllNodes');
const app = express();
const port = 3000;
const multer = require('multer');

const upload = require('./ServerScripts/UpdateStorageDestination');

// Increase the request body limit for JSON and urlencoded data
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

const allowedExtensions = ['.html', '.php', '.js', '.py'];
const notebookDir = path.join(__dirname, 'Notebook');

// Function to run server-side scripts
function runScript(script) {
    return new Promise((resolve, reject) => {
        exec(`node ${script}`, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error running ${script}: ${stderr}`);
                reject(err);
                return;
            }
            console.log(`${script} output: ${stdout}`);
            resolve(stdout);
        });
    });
}
app.post('/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('Error uploading file:', err);
            return res.status(500).send(`Error uploading file: ${err.message}`);
        }
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }
        res.send(`File uploaded successfully: ${req.file.originalname}`);
    });
});



// List of server scripts
const serverScripts = [
    'UpdateStorageDestination',
    'ServeFavicon',
    'MoveToTrash',
    'UploadImage',
    'Search',
    'GetFile',
    'ExtractPictureURLfromFile',
    'GetSubNodesSingleInstance',
    'SaveFileServerSide',
    'Search',
    'CreateDirectoryServerSide',
    'UpdateGraphStyles',
    'GenerateEdgesServerSide'
];

serverScripts.forEach(script => {
    const scriptModule = require(`./ServerScripts/${script}.js`);
    if (typeof scriptModule === 'function') {
        scriptModule(app, path, fs, upload);  // Pass upload as an additional argument
    } else {
        console.error(`${script}.js does not export a function`);
    }
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

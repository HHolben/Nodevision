const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const fs = require('fs').promises; // For async operations
const multer = require('multer');
const cheerio = require('cheerio');
const { generateEdges } = require('./GenerateEdges');
const { generateAllNodes } = require('./GenerateAllNodes');
const { generateNodes } = require('./GenerateNodes');

const SerialPort = require('serialport');
const Avrgirl = require('avrgirl-arduino');

const app = express();
const port = 3000;

// Increase the request body limit for JSON and urlencoded data
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

const allowedExtensions = ['.html', '.php', '.js', '.py'];
const notebookDir = path.join(__dirname, 'Notebook'); // Define notebookDir

// Serve favicon
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));
app.use('/Notebook', express.static(path.join(__dirname, 'Notebook')));

// Endpoint to initialize HTML file and regenerate graph
app.post('/initialize', async (req, res) => {
    const { htmlContent, fileName } = req.body;
    const filePath = path.join(__dirname, 'Notebook', fileName);

    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, htmlContent);
        console.log(`HTML file "${filePath}" created successfully!`);




    } catch (error) {
        console.error('Error creating HTML file:', error);
        res.status(500).send('Error creating HTML file.');
    }
});

// Endpoint to create a new directory within the Notebook directory
app.post('/api/create-directory', async (req, res) => {
    const { folderName, parentPath } = req.body;

    if (!folderName || typeof folderName !== 'string') {
        return res.status(400).json({ error: 'A valid folder name is required.' });
    }

    const newDirPath = path.join(notebookDir, parentPath || '', folderName);

    try {
        // Create the new directory, ensuring any intermediate directories are created
        await fs.mkdir(newDirPath, { recursive: true });
        res.status(200).json({ message: `Directory "${folderName}" created successfully at "${path.relative(notebookDir, newDirPath)}".` });
    } catch (error) {
        console.error('Error creating directory:', error);
        res.status(500).json({ error: 'Failed to create directory.' });
    }
});


// Endpoint to update graph styles
app.post('/updateGraphStyles', async (req, res) => {
    const newStyles = req.body.styles;
    const stylesFilePath = path.join(__dirname, 'public', 'GraphStyles.js');

    try {
        let currentStyles = await fs.readFile(stylesFilePath, 'utf8');
        currentStyles = currentStyles.replace(/background-color: #66ccff;/g, newStyles);
        await fs.writeFile(stylesFilePath, currentStyles, 'utf8');
        res.status(200).send('Graph styles updated successfully.');
    } catch (error) {
        console.error('Error updating GraphStyles.js:', error);
        res.status(500).send('Failed to update graph styles.');
    }
});

// Update storage destination to save in 'Notebook' directory
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'Notebook'));  // Save to Notebook directory
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));  // Use unique filename
    }
});

const upload = multer({ storage: storage });

// Endpoint to upload images
app.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const filePath = `/Notebook/${req.file.filename}`;  // Return path for serving
    res.json({ success: true, message: 'Image uploaded successfully', filePath });
});

// Search API endpoint
app.get('/api/search', async (req, res) => {
    const searchQuery = req.query.q.toLowerCase();  // Get the search query from the client

    try {
        // Read the list of files in the Notebook directory
        const files = await fs.readdir(notebookDir);

        // Filter files that match the search query (case-insensitive)
        const matchedFiles = files.filter(file => file.toLowerCase().includes(searchQuery));

        // Return the matching files
        res.json({ files: matchedFiles });
    } catch (error) {
        console.error('Error reading files from Notebook directory:', error);
        res.status(500).send('Error searching for files');
    }
});


// Endpoint to get directory structure for FileView mode
app.get('/api/files', async (req, res) => {
    const dir = req.query.path ? path.join(notebookDir, req.query.path) : notebookDir;

    async function readDirectory(dir) {
        const result = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                result.push({
                    name: entry.name,
                    path: path.relative(notebookDir, fullPath),
                    isDirectory: true
                });
            } else if (allowedExtensions.includes(path.extname(entry.name))) {
                result.push({
                    name: entry.name,
                    path: path.relative(notebookDir, fullPath),
                    isDirectory: false
                });
            }
        }
        return result;
    }

    try {
        const structure = await readDirectory(dir);
        res.json(structure);
    } catch (error) {
        console.error('Error reading directory structure:', error);
        res.status(500).json({ error: 'Error reading directory structure' });
    }
});






// Endpoint to read file content
app.get('/api/file', async (req, res) => {
    const filePath = req.query.path;
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = path.join(__dirname, 'Notebook', filePath);

    try {
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
            // Return a 400 error if the requested path is a directory
            return res.status(400).json({ error: `The path ${filePath} is a directory, not a file` });
        }

        const data = await fs.readFile(fullPath, 'utf8');
        res.json({ content: data });
    } catch (err) {
        console.error(`Error reading file ${filePath}:`, err);

        // Return a structured error response
        if (err.code === 'ENOENT') {
            // File not found
            res.status(404).json({ error: `File ${filePath} not found` });
        } else {
            // Other server error
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.get('/api/fileCodeContent', async (req, res) => {
    const filePath = req.query.path;
    if (!filePath) {
        return res.status(400).send('File path is required');
    }

    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.send({ content: data });
    } catch (err) {
        res.status(500).send('Error reading file');
    }
});





// Function to extract the first image URL from the file content
async function getFirstImageUrl(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const $ = cheerio.load(fileContent);
        const firstImageSrc = $('img').first().attr('src');

        if (firstImageSrc) {
            if (firstImageSrc.startsWith('http') || firstImageSrc.startsWith('//')) {
                // If the image URL is absolute, return it as is
                return firstImageSrc;
            } else {
                // If the image URL is relative, resolve it to an absolute path
                const imagePath = path.join(path.dirname(filePath), firstImageSrc);
                const resolvedImagePath = path.relative(path.join(__dirname, 'public'), imagePath);
                return resolvedImagePath.split(path.sep).join('/');
            }
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Error reading file for images: ${error}`);
        return null;
    }
}

// Endpoint to get sub-nodes
app.get('/api/getSubNodes', async (req, res) => {
    const regionPath = req.query.path;
    if (!regionPath) {
        return res.status(400).send('Region path is required');
    }

    const dirPath = path.join(__dirname, 'Notebook', regionPath);

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const subNodes = await Promise.all(entries.map(async entry => {
            let imageUrl = 'DefaultNodeImage.png'; // Default image for nodes
            const fileExtension = path.extname(entry.name).toLowerCase();

            if (entry.isDirectory()) {
                const directoryImage = path.join(dirPath, entry.name, 'directory.png');
                try {
                    await fs.access(directoryImage);
                    imageUrl = `Notebook/${regionPath}/${entry.name}/directory.png`;
                } catch {
                    imageUrl = 'DefaultRegionImage.png';
                }
                return {
                    id: path.join(regionPath, entry.name),
                    label: entry.name,
                    isDirectory: true,
                    imageUrl: imageUrl
                };
            } else if (allowedExtensions.includes(fileExtension)) {
                const filePath = path.join(dirPath, entry.name);
                const firstImage = await getFirstImageUrl(filePath);
                imageUrl = firstImage ? firstImage : 'DefaultNodeImage.png';
                return {
                    id: path.join(regionPath, entry.name),
                    label: entry.name,
                    isDirectory: false,
                    imageUrl: imageUrl
                };
            } else {
                return null; // Skip non-allowed file types
            }
        }));

        // Filter out null values (non-allowed file types)
        const filteredSubNodes = subNodes.filter(node => node !== null);

        res.json(filteredSubNodes);
    } catch (error) {
        console.error('Error reading directory:', error);
        res.status(500).send('Error reading directory');
    }
});

// Endpoint to generate edges
app.post('/generateEdges', async (req, res) => {
    try {
        await generateEdges();
        res.status(200).send('Edges generated successfully');
    } catch (error) {
        console.error('Error generating edges:', error);
        res.status(500).send('Failed to generate edges');
    }
});

// Endpoint to save file content
app.post('/api/save', async (req, res) => {
    const { path: filePath, content } = req.body;

    if (!filePath || !content) {
        return res.status(400).send('File path and content are required');
    }

    try {
        await fs.writeFile(filePath, content, 'utf8');
        res.send('File saved successfully');
    } catch (err) {
        res.status(500).send('Error saving file');
    }
});

// Endpoint to regenerate all nodes
app.get('/api/regenerateAllNodes', async (req, res) => {
    try {
        const allNodes = generateAllNodes(notebookDir);
        const allNodesOutput = `// AllNodes.js\nconst allNodes = [\n${allNodes.map(node => JSON.stringify(node, null, 2)).join(',\n')}\n];`;
        const generatedAllNodesPath = path.join(__dirname, 'public', 'AllNodes.js');
        await fs.writeFile(generatedAllNodesPath, allNodesOutput, 'utf8');
        res.status(200).send('All nodes regenerated successfully.');
    } catch (err) {
        console.error('Error generating all nodes:', err);
        res.status(500).send('Failed to regenerate all nodes.');
    }
});


// Endpoint to list available serial ports
app.get('/api/arduino/ports', async (req, res) => {
    try {
        const ports = await SerialPort.list();
        res.json(ports);
    } catch (error) {
        console.error('Error listing serial ports:', error);
        res.status(500).json({ error: 'Failed to list serial ports.' });
    }
});





// Endpoint to upload code to Arduino
app.post('/api/arduino/upload', async (req, res) => {
    const { code, board, port } = req.body;

    if (!code || !board || !port) {
        return res.status(400).json({ error: 'Code, board, and port are required.' });
    }

    // Save the Arduino code to a temporary .ino file
    const tempSketchPath = path.join(__dirname, 'temp', 'sketch.ino');
    try {
        await fs.mkdir(path.dirname(tempSketchPath), { recursive: true });
        await fs.writeFile(tempSketchPath, code);

        // Configure Avrgirl for the board and port
        const avrgirl = new Avrgirl({ board, port, debug: true });

        // Upload the sketch
        avrgirl.flash(tempSketchPath, (err) => {
            if (err) {
                console.error('Error uploading sketch:', err);
                return res.status(500).json({ error: 'Upload failed.', details: err.message });
            }
            res.json({ message: 'Sketch uploaded successfully.' });
        });
    } catch (error) {
        console.error('Error preparing sketch upload:', error);
        res.status(500).json({ error: 'Failed to prepare upload.' });
    }
});





app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

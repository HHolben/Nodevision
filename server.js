const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const fs = require('fs').promises; // For async operations
const syncFs = require('fs'); // For synchronous operations
const { exec } = require('child_process');
const cheerio = require('cheerio');
const multer = require('multer');
const { generateEdges } = require('./GenerateEdges'); // Import the new script
const app = express();
const port = 3000;

const allowedExtensions = ['.html', '.php', '.js', '.py'];
const notebookDir = path.join(__dirname, 'Notebook'); // Define notebookDir

const { generateAllNodes } = require('./GenerateAllNodes'); // Import the generateAllNodes function

// Serve favicon
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));
app.use('/Notebook', express.static(path.join(__dirname, 'Notebook')));

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

app.post('/initialize', async (req, res) => {
    const { htmlContent, fileName } = req.body;
    const filePath = path.join(__dirname, 'Notebook', fileName);

    try {
        await fs.mkdir(path.join(__dirname, 'Notebook'), { recursive: true });
        await fs.writeFile(filePath, htmlContent);
        console.log(`HTML file "${filePath}" has been successfully created!`);
        await runScript('RegenerateGraph.js');
        res.send('HTML file has been created successfully and graph regenerated.');
    } catch (error) {
        console.error('Error writing HTML file:', error);
        res.status(500).send('Error creating HTML file');
    }
});

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

app.get('/api/file', async (req, res) => {
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

// New function to extract the first image URL from the file content
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

// Single instance of getSubNodes API
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

app.post('/generateEdges', async (req, res) => {
    try {
        await generateEdges();
        res.status(200).send('Edges generated successfully');
    } catch (error) {
        console.error('Error generating edges:', error);
        res.status(500).send('Failed to generate edges');
    }
});

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

const regenerateGraph = require('./RegenerateGraph');
app.use(regenerateGraph);

// Use the RegenerateGraph.js script
app.get('/api/regenerateAllNodes', async (req, res) => {
    const generateAllNodes = require('./GenerateAllNodes.js').generateAllNodes;
    const generatedAllNodesPath = path.join(__dirname, 'public', 'AllNodes.js');

    try {
        const allNodes = generateAllNodes(notebookDir);
        const allNodesOutput = `// AllNodes.js\nconst allNodes = [\n${allNodes.map(node => JSON.stringify(node, null, 2)).join(',\n')}\n];`;
        await fs.writeFile(generatedAllNodesPath, allNodesOutput, 'utf8');
        res.status(200).send('All nodes regenerated successfully.');
    } catch (err) {
        console.error('Error generating all nodes:', err);
        res.status(500).send('Failed to regenerate all nodes.');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

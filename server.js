const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const multer = require('multer');
const cheerio = require('cheerio');
const { exec } = require('child_process');

const app = express();
const port = 3000;

// Middleware setup (configure body size limits first)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));
app.use('/Notebook', express.static(path.join(__dirname, 'Notebook')));

// Serve favicon
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// Update storage destination to save in 'Notebook' directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'Notebook'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // Set a file size limit (50 MB)
});

// Function to extract the first image URL from the file content
async function getFirstImageUrl(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const $ = cheerio.load(fileContent);
    const firstImageSrc = $('img').first().attr('src');

    if (firstImageSrc) {
      if (firstImageSrc.startsWith('http') || firstImageSrc.startsWith('//')) {
        return firstImageSrc;
      } else {
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

// POST route for /send-request
app.post('/send-request', (req, res) => {
  const { endpoint, command } = req.body;

  if (!endpoint || !command) {
    return res.status(400).json({ error: 'Endpoint and command are required' });
  }

  const commandToRun = `node ${path.join(__dirname, 'sendRequest.js')} ${endpoint} "${command}"`;

  exec(commandToRun, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: stderr || error.message });
    }

    res.json({ response: stdout });
  });
});

// POST route for /api/endpoint1
app.post('/api/endpoint1', (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  console.log(`Received command at /api/endpoint1: ${command}`);

  if (command.toLowerCase() === 'ping') {
    return res.json({ message: 'pong' });
  }

  res.json({ message: 'Command received on endpoint1', receivedCommand: command });
});

// Routes
const initializeRoute = require('./routes/api/initialize');
const initializeRoutes = require('./routes/api/initializeRoutes');
const fileRoutes = require('./routes/api/files');
const folderRoutes = require('./routes/api/folderRoutes');
const fileSaveRoutes = require('./routes/api/fileSaveRoutes');
const regenerateNodesRoutes = require('./routes/api/regenerateNodesRoutes');
const generateEdgesRoutes = require('./routes/api/generateEdgesRoutes');
const getSubNodesRoutes = require('./routes/api/getSubNodesRoutes');
const fileCodeContentRoutes = require('./routes/api/fileCodeContentRoutes');
const fileSearchRoutes = require('./routes/api/search');
const graphStylesRoutes = require('./routes/api/graphStyles');
const uploadImageRoutes = require('./routes/api/uploadImage');

// Use routes
app.use('/api', initializeRoute);
app.use('/api', initializeRoutes);
app.use('/api', fileRoutes);
app.use('/api/folderRoutes', folderRoutes);
app.use('/api', fileSaveRoutes);
app.use('/api', regenerateNodesRoutes);
app.use('/api', generateEdgesRoutes);
app.use('/api', getSubNodesRoutes);
app.use('/api', fileCodeContentRoutes);
app.use('/api', fileSearchRoutes);
app.use('/api', graphStylesRoutes);
app.use('/api', uploadImageRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

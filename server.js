//Nodevision/server.js

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const fs = require('fs'); // For synchronous file checks
const fsPromises = require('fs').promises; // For async operations
const multer = require('multer');
const cheerio = require('cheerio');
const { exec } = require('child_process');
const userSettingsDir = path.join(__dirname, 'UserSettings');
const gamepadSettingsFile = path.join(userSettingsDir, 'GameControllerSettings.json');

// Ensure the UserSettings folder exists
if (!fs.existsSync(userSettingsDir)) fs.mkdirSync(userSettingsDir, { recursive: true });


const app = express();
const port = process.env.PORT || 5000; // Use port from .env or default to 5000

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
  limits: { fileSize: 50 * 1024 * 1024 } // File size limit (50 MB)
});

// Function to extract the first image URL from the file content
async function getFirstImageUrl(filePath) {
  try {
    const fileContent = await fsPromises.readFile(filePath, 'utf8');
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

// Dynamically load routes from JSON
async function loadRoutes() {
  try {
    const data = await fsPromises.readFile(path.join(__dirname, 'routes.json'), 'utf8');
    const { routes } = JSON.parse(data);

    routes.forEach(({ name, path: routePath }) => {
      const absoluteRoutePath = path.resolve(__dirname, routePath);
      
      console.log(`Attempting to load route: ${name} from ${routePath}`); // Debugging
    
      if (fs.existsSync(absoluteRoutePath)) {
        try {
          const route = require(absoluteRoutePath);
          app.use('/api', route);
          console.log(`✅ Loaded route: ${name} from ${absoluteRoutePath}`);
        } catch (err) {
          console.error(`❌ Error requiring route ${name} from ${routePath}:`, err);
        }
      } else {
        console.error(`❌ Route file not found: ${absoluteRoutePath}`);
      }
    });
    
  } catch (error) {
    console.error('Error loading routes:', error.message);
  }
}

// Call loadRoutes to initialize routes
loadRoutes();


//List top-level Notebook entries
app.get('/api/topLevelNodes', async (req, res) => {
  const dir = path.join(__dirname, 'Notebook');
  const entries = await fsPromises.readdir(dir);
  res.json(entries);
});
// List directory entries (files & folders)
app.get('/api/list-directory', async (req, res) => {
  const relPath = req.query.path || '';
  const fullPath = path.join(__dirname, relPath);
  try {
    const entries = await fsPromises.readdir(fullPath, { withFileTypes: true });
    const result = entries.map(entry => ({
      name: entry.name,
      fileType: entry.isDirectory() ? 'directory' : 'file'
    }));
    res.json(result);
  } catch (err) {
    console.error('Failed to list directory:', fullPath, err);
    res.status(500).json({ error: 'Failed to list directory', details: err.message });
  }
});

// List file-to-file links in a directory
app.get('/api/list-links', async (req, res) => {
  const relPath = req.query.path || '';
  const dirFull = path.join(__dirname, relPath);
  try {
    const entries = await fsPromises.readdir(dirFull, { withFileTypes: true });
    const links = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.md', '.txt', '.html', '.js'].includes(ext)) {
          const content = await fsPromises.readFile(path.join(dirFull, entry.name), 'utf8');
          const regex = /\[\[([^\]]+)\]\]|\[.*?\]\((.*?)\)/g;
          let match;
          while ((match = regex.exec(content))) {
            const target = match[1] || match[2];
            if (target) links.push({ source: entry.name, target });
          }
        }
      }
    }
    res.json(links);
  } catch (err) {
    console.error('Failed to list links for', dirFull, err);
    res.status(500).json({ error: 'Failed to list links', details: err.message });
  }
});


// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));


// Load gamepad settings
app.get('/api/load-gamepad-settings', async (req, res) => {
  try {
    if (!fs.existsSync(gamepadSettingsFile)) return res.json({});
    const data = await fsPromises.readFile(gamepadSettingsFile, 'utf8');
    const json = JSON.parse(data);
    res.json(json);
  } catch (err) {
    console.error('Error reading gamepad settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save gamepad settings
app.post('/api/save-gamepad-settings', async (req, res) => {
  try {
    await fsPromises.writeFile(gamepadSettingsFile, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving gamepad settings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/api/load-world', async (req, res) => {
  const { worldPath } = req.body;
  if (!worldPath) {
      return res.status(400).json({ error: "No world path provided" });
  }

  const filePath = path.join(__dirname, 'Notebook', worldPath);
  
  try {
      // Read the HTML file
      const fileContent = await fsPromises.readFile(filePath, 'utf8');
      
      // Extract world definition from the HTML file
      const $ = cheerio.load(fileContent);
      const worldScript = $('script[type="application/json"]').html();
      
      if (!worldScript) {
          return res.status(400).json({ error: "No world definition found in file" });
      }

      const worldDefinition = JSON.parse(worldScript);
      res.json({ worldDefinition });
  } catch (error) {
      console.error("Error loading world:", error);
      res.status(500).json({ error: "Error loading world" });
  }
});


app.get('/api/list-directory', async (req, res) => {
  const relPath = req.query.path || '';
  const fullPath = path.join(__dirname, relPath);

  try {
    const entries = await fsPromises.readdir(fullPath, { withFileTypes: true });
    const result = entries.map(entry => ({
      name: entry.name,
      fileType: entry.isDirectory() ? 'directory' : 'file'
    }));
    res.json(result);
  } catch (err) {
    console.error('Failed to list directory:', err);
    res.status(500).json({ error: 'Failed to list directory', details: err.message });
  }
});

// Server setup
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});

module.exports = app;

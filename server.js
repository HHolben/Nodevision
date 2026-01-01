// Nodevision/server.js
// Purpose: Main Express server with dual Node.js/PHP setup, API routes, file serving, and graph-based content management

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import favicon from 'serve-favicon';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import multer from 'multer';
import * as cheerio from 'cheerio';
import { exec } from 'node:child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';

import toolbarRoutes from "./routes/api/toolbarRoutes.js";
import graphDataRoutes from "./routes/api/graphData.js";





const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userSettingsDir = path.join(__dirname, 'UserSettings');
const gamepadSettingsFile = path.join(userSettingsDir, 'KeyboardAndControlSchemes/GameControllerSettings.json');

// Ensure the UserSettings folder exists
if (!fs.existsSync(userSettingsDir)) fs.mkdirSync(userSettingsDir, { recursive: true });

const app = express();
const port = process.env.PORT || 3000; // Use port from .env or default to 3000


// Middleware setup (configure body size limits first)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


app.use('/lib/monaco', express.static(path.join(__dirname, 'public/lib/monaco')));



import listDirectoryRouter from "./routes/api/listDirectory.js";



app.use("/api", listDirectoryRouter);



import uploadRoutes from './routes/api/fileUploadRoutes.js';
app.use('/api/file', uploadRoutes);



// Secure helper function to validate and normalize paths
function validateAndNormalizePath(userPath, allowedBaseDir) {
  if (!userPath) return allowedBaseDir;
  
  // Remove any null bytes and normalize path
  const sanitized = userPath.replace(/\0/g, '').replace(/\\/g, '/');
  const resolved = path.resolve(allowedBaseDir, sanitized);
  
  // Ensure the resolved path is within the allowed directory using proper relative path checking
  const relative = path.relative(allowedBaseDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Access denied: Path outside allowed directory');
  }
  
  return resolved;
}

// Set up reverse proxy for PHP server (assuming PHP runs on port 8080)
const phpProxyOptions = {
  target: 'http://localhost:8080',
  changeOrigin: true,
  pathRewrite: {
    '^/php': '', // Remove /php prefix when forwarding to PHP server
  },
  onError: (err, req, res) => {
    console.error('PHP proxy error:', err.message);
    res.status(503).json({ error: 'PHP server unavailable' });
  }
};

// Apply PHP proxy middleware for /php/* routes
app.use('/php', createProxyMiddleware(phpProxyOptions));


// 1. Explicitly allow the data folder with the prefix you want
app.use('/public/data', express.static(path.join(__dirname, 'public/data')));

// 2. Then the general public folder
// Serve static files with security restrictions and no caching for development
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, path) => {
    if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));



// Restrict vendor access to only necessary client libraries (SECURITY FIX)
app.use('/vendor/monaco-editor', express.static(path.join(__dirname, 'node_modules/monaco-editor')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));
app.use('/vendor/cytoscape', express.static(path.join(__dirname, 'node_modules/cytoscape')));
app.use('/vendor/mathjax', express.static(path.join(__dirname, 'node_modules/mathjax')));
app.use('/vendor/vexflow', express.static(path.join(__dirname, 'node_modules/vexflow')));
app.use('/vendor/tesseract.js', express.static(path.join(__dirname, 'node_modules/tesseract.js')));
app.use('/vendor/layout-base', express.static(path.join(__dirname, 'node_modules/layout-base')));
app.use('/vendor/cytoscape-expand-collapse', express.static(path.join(__dirname, 'node_modules/cytoscape-expand-collapse')));
app.use('/vendor/cytoscape-fcose', express.static(path.join(__dirname, 'node_modules/cytoscape-fcose')));
app.use('/vendor/cose-base', express.static(path.join(__dirname, 'node_modules/cose-base')));
app.use('/vendor/requirejs', express.static(path.join(__dirname, 'node_modules/requirejs')));
app.use('/vendor/babel', express.static(path.join(__dirname, 'public/vendor/babel')));
app.use('/vendor/react', express.static(path.join(__dirname, 'public/vendor/react')));


app.use("/api/toolbar", toolbarRoutes);
app.use("/api/graph", graphDataRoutes);

app.use('/UserSettings', express.static(path.join(__dirname, 'UserSettings')));


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

    for (const { name, path: routePath } of routes) {
      const absoluteRoutePath = path.resolve(__dirname, routePath);
      
      console.log(`Attempting to load route: ${name} from ${routePath}`); // Debugging
    
      if (fs.existsSync(absoluteRoutePath)) {
        try {
          const mod = await import(pathToFileURL(absoluteRoutePath).href);
          const route = mod.default ?? mod;
          app.use('/api', route);
          console.log(`✅ Loaded route: ${name} from ${absoluteRoutePath}`);
        } catch (err) {
          console.error(`❌ Error importing route ${name} from ${routePath}:`, err);
        }
      } else {
        console.error(`❌ Route file not found: ${absoluteRoutePath}`);
      }
    }
    
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

// List directory entries (files & folders) - SECURE VERSION (SECURITY FIX)
app.get('/api/list-directory', async (req, res) => {
  try {
    const relPath = req.query.path || '';
    const notebookDir = path.join(__dirname, 'Notebook');
    const fullPath = validateAndNormalizePath(relPath, notebookDir);
    
    const entries = await fsPromises.readdir(fullPath, { withFileTypes: true });
    const result = entries.map(entry => ({
      name: entry.name,
      fileType: entry.isDirectory() ? 'directory' : 'file'
    }));
    res.json(result);
  } catch (err) {
    console.error('Failed to list directory:', err.message);
    res.status(403).json({ error: 'Access denied or directory not found' });
  }
});



// List file-to-file links in a directory - SECURE VERSION (SECURITY FIX)
app.get('/api/list-links', async (req, res) => {
  try {
    const relPath = req.query.path || '';
    const notebookDir = path.join(__dirname, 'Notebook');
    const dirFull = validateAndNormalizePath(relPath, notebookDir);
    
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
    console.error('Failed to list links:', err.message);
    res.status(403).json({ error: 'Access denied or directory not found' });
  }
});


// Generic edge-bucket JSON saver (case-sensitive, by first character)
app.post('/api/graph/save-edges', async (req, res) => {
  try {
    const { filename, data } = req.body;

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'filename is required' });
    }

    if (typeof data !== 'object') {
      return res.status(400).json({ error: 'data must be a JSON object' });
    }

    // Determine bucket character (CASE-SENSITIVE)
    let char = filename.trim()[0];
    if (!char) char = '#';

    // Optional safety: restrict to sane filename chars
    if (!/^[A-Za-z0-9]$/.test(char)) {
      char = '#';
    }

    const edgesDir = path.join(__dirname, 'public/data/edges');
    const targetFile = path.join(edgesDir, `${char}.json`);

    await fsPromises.mkdir(edgesDir, { recursive: true });

    // Atomic write
    const tmpFile = targetFile + '.tmp';
    await fsPromises.writeFile(
      tmpFile,
      JSON.stringify(data, null, 2),
      'utf8'
    );
    await fsPromises.rename(tmpFile, targetFile);

    res.json({
      success: true,
      bucket: char,
      path: `public/data/edges/${char}.json`
    });
  } catch (err) {
    console.error('Failed to save edge bucket:', err);
    res.status(500).json({ error: 'Failed to save edge data' });
  }
});






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

  try {
    // Use secure path validation (SECURITY FIX)
    const notebookDir = path.join(__dirname, 'Notebook');
    const filePath = validateAndNormalizePath(worldPath, notebookDir);
    
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

// Server setup
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log(`🔒 Security improvements applied:`);
  console.log(`  - Directory traversal vulnerabilities fixed`);
  console.log(`  - Vendor directory access restricted to necessary libraries only`);
  console.log(`  - PHP proxy available at /php/*`);
});

export default app;
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
import { createProxyMiddleware } from 'http-proxy-middleware';
import cookieParser from 'cookie-parser';

import * as AuthService from './Auth/AuthService.mjs';
import { ensureDefaultAdminAccount } from './Auth/userStore.mjs';

import toolbarRoutes from "./routes/api/toolbarRoutes.js";
import graphDataRoutes from "./routes/api/graphData.js";
import listDirectoryRouter from "./routes/api/listDirectory.js";
import uploadRoutes from './routes/api/fileUploadRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const NOTEBOOK_DIR = path.join(ROOT_DIR, 'Notebook');
const USER_SETTINGS_DIR = path.join(ROOT_DIR, 'UserSettings');
const USER_DATA_DIR = path.join(ROOT_DIR, 'UserData');
const SHARED_DATA_DIR = path.join(USER_DATA_DIR, 'data');

const userSettingsDir = USER_SETTINGS_DIR;
const gamepadSettingsFile = path.join(userSettingsDir, 'KeyboardAndControlSchemes/GameControllerSettings.json');

// Ensure the UserSettings folder exists
if (!fs.existsSync(userSettingsDir)) fs.mkdirSync(userSettingsDir, { recursive: true });
// Ensure the UserData/data folder exists
if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });
if (!fs.existsSync(SHARED_DATA_DIR)) fs.mkdirSync(SHARED_DATA_DIR, { recursive: true });

try {
  await ensureDefaultAdminAccount();
} catch (err) {
  console.error('Failed to bootstrap authentication data:', err);
}

function requireAuthentication(req, res, next) {
  if (req.identity) {
    return next();
  }
  return res.redirect('/');
}

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

const phpProxyOptions = {
  target: 'http://localhost:8080',
  changeOrigin: true,
  pathRewrite: {
    '^/php': '',
  },
  onError: (err, req, res) => {
    console.error('PHP proxy error:', err.message);
    res.status(503).json({ error: 'PHP server unavailable' });
  }
};

// Dynamically load routes from JSON
async function loadRoutes(app) {
  try {
    const data = await fsPromises.readFile(path.join(__dirname, 'routes.json'), 'utf8');
    const { routes } = JSON.parse(data);

    for (const { name, path: routePath } of routes) {
      const absoluteRoutePath = path.resolve(__dirname, routePath);
      
      console.log(`Attempting to load route: ${name} from ${routePath}`);
    
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

export default async function createApp(runtimeConfig = {}) {
  const app = express();

  // Middleware setup (configure body size limits first)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  app.use(async (req, res, next) => {
    try {
      req.identity = await AuthService.authenticateRequest(req);
    } catch (err) {
      return next(err);
    }
    next();
  });

  app.get('/api/session', (req, res) => {
    if (!req.identity) {
      return res.status(200).json({ loggedIn: false });
    }

    const { id, username, role, type } = req.identity;
    res.status(200).json({
      loggedIn: true,
      identity: { id, username, role, type },
    });
  });

  app.get('/login', (req, res) => {
    res.redirect('/');
  });

  app.use('/lib/monaco', express.static(path.join(__dirname, 'public/lib/monaco')));
  app.use("/api", listDirectoryRouter);
  app.use('/api/file', uploadRoutes);

  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await AuthService.login({
        username,
        password,
        ip: req.ip,
      });

      const expiresMs = Math.max(result.expires * 1000 - Date.now(), 0);
      res.cookie('nodevision_session', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: expiresMs,
        path: '/',
      });

      res.json({
        success: true,
        identity: result.identity,
        expires: result.expires,
      });
    } catch (err) {
      if (err?.message === 'Invalid credentials') {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      console.error('Login error', err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/logout', async (req, res) => {
    try {
      const token = req.cookies?.nodevision_session;
      await AuthService.logout(token);
      res.clearCookie('nodevision_session', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Logout error', err);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  app.use('/php', createProxyMiddleware(phpProxyOptions));
  app.use('/public/data', express.static(SHARED_DATA_DIR));
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
  app.use('/UserSettings', express.static(USER_SETTINGS_DIR));
  app.use('/Notebook', requireAuthentication, express.static(NOTEBOOK_DIR));
  app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, NOTEBOOK_DIR);
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
  });

  await loadRoutes(app);

  app.get('/api/topLevelNodes', async (req, res) => {
    const dir = NOTEBOOK_DIR;
    const entries = await fsPromises.readdir(dir);
    res.json(entries);
  });

  app.get('/api/list-directory', async (req, res) => {
    try {
      const relPath = req.query.path || '';
      const notebookDir = NOTEBOOK_DIR;
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

  app.get('/api/list-links', async (req, res) => {
    try {
      const relPath = req.query.path || '';
      const notebookDir = NOTEBOOK_DIR;
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

  app.post('/api/graph/save-edges', async (req, res) => {
    try {
      const { filename, data } = req.body;
      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ error: 'filename is required' });
      }
      if (typeof data !== 'object') {
        return res.status(400).json({ error: 'data must be a JSON object' });
      }
      let char = filename.trim()[0];
      if (!char) char = '#';
      if (!/^[A-Za-z0-9]$/.test(char)) {
        char = '#';
      }
      const edgesDir = path.join(SHARED_DATA_DIR, 'edges');
      const targetFile = path.join(edgesDir, `${char}.json`);
      await fsPromises.mkdir(edgesDir, { recursive: true });
      const tmpFile = targetFile + '.tmp';
      await fsPromises.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf8');
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
    let { worldPath } = req.body;
    if (!worldPath) {
      return res.status(400).json({ error: "No world path provided" });
    }
    try {
      worldPath = worldPath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/^\.\//, '')
        .replace(/^Notebook\//, '');
      const notebookDir = NOTEBOOK_DIR;
      const filePath = validateAndNormalizePath(worldPath, notebookDir);
      const fileContent = await fsPromises.readFile(filePath, 'utf8');
      const $ = cheerio.load(fileContent);
      const worldScript = $('script[type="application/json"]').html();
      if (!worldScript) {
        return res.status(400).json({ error: "No world definition found in file" });
      }
      const cleaned = worldScript
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
        .trim();
      const worldDefinition = JSON.parse(cleaned);
      res.json({ worldDefinition });
    } catch (error) {
      res.status(500).json({ error: "Error loading world", details: error?.message || "Unknown error" });
    }
  });

  return app;
}

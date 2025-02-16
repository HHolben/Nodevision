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

const app = express();
const port = process.env.PORT || 3000; // Use port from .env or default to 3000

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

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve the 3D world page at the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', '3DWorld.html'));
});



// Server setup
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = app;

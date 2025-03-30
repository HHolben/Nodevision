const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const routesFilePath = path.join(__dirname, '../../routes.json'); // Ensure correct path

// Endpoint to get available API routes
router.get('/routes', (req, res) => {
  try {
    if (!fs.existsSync(routesFilePath)) {
      return res.status(500).json({ error: 'routes.json not found' });
    }

    const routesConfig = JSON.parse(fs.readFileSync(routesFilePath, 'utf8'));
    const apiRoutes = routesConfig.routes.map(route => route.path);

    res.json({ routes: apiRoutes });
  } catch (error) {
    console.error('Error reading routes.json:', error);
    res.status(500).json({ error: 'Failed to load routes' });
  }
});

module.exports = router;

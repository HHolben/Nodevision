// routes/api/getRoutes.js
// Route discovery endpoint

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createGetRoutesRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const routesFilePath = path.join(ctx.applicationSystemRoot, 'routes.json');

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

  return router;
}

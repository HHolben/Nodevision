// Nodevision/ApplicationSystem/server.mjs
// This file initializes the Nodevision Express application and wires core middleware, static asset serving, authentication, and API routes into a single server entry point.

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import favicon from 'serve-favicon';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cookieParser from 'cookie-parser';

import * as AuthService from './Auth/AuthService.mjs';
import { ensureDefaultAdminAccount } from './Auth/userStore.mjs';

import toolbarRoutes from "./routes/api/toolbarRoutes.js";
import graphDataRoutes from "./routes/api/graphData.js";
import listDirectoryRouter from "./routes/api/listDirectory.js";
import uploadRoutes from './routes/api/fileUploadRoutes.js';
import previewRuntimeRoutes from './routes/api/previewRuntimeRoutes.js';
import previewRuntimeControlRoutes from './routes/api/previewRuntimeControlRoutes.js';
import { createServerContext, ensureServerDirectories } from './shared/serverContext.mjs';

import { phpProxyOptions } from "./server/phpProxy.mjs";
import { loadRoutes } from "./server/dynamicRoutes.mjs";
import { identityMiddleware, requireAuthentication } from "./server/middleware/authIdentity.mjs";
import { registerAuthRoutes } from "./server/routes/authRoutes.mjs";
import { registerNotebookRoutes } from "./server/routes/notebookRoutes.mjs";
import { registerGraphExtras } from "./server/routes/graphExtras.mjs";
import { registerGamepadRoutes } from "./server/routes/gamepadRoutes.mjs";
import { registerWorldRoutes } from "./server/routes/worldRoutes.mjs";

export default async function createApp(runtimeConfig = {}) {
  const ctx = createServerContext(runtimeConfig);
  ensureServerDirectories(ctx);

  try {
    await ensureDefaultAdminAccount();
  } catch (err) {
    console.error('Failed to bootstrap authentication data:', err);
  }

  const NOTEBOOK_DIR = ctx.notebookDir;
  const USER_SETTINGS_DIR = ctx.userSettingsDir;
  const USER_DATA_DIR = ctx.userDataDir;
  const SHARED_DATA_DIR = ctx.sharedDataDir;
  const PUBLIC_DIR = ctx.publicDir;
  const NODE_MODULES_DIR = ctx.nodeModulesDir;

  const app = express();

  // Middleware setup (configure body size limits first)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  app.use(identityMiddleware(AuthService));
  registerAuthRoutes(app, AuthService);

  app.use('/lib/monaco', express.static(path.join(PUBLIC_DIR, 'lib/monaco')));
  app.use("/api", listDirectoryRouter(ctx));
  app.use('/api/file', uploadRoutes);

  app.use('/php', createProxyMiddleware(phpProxyOptions));
  app.use('/public/data', express.static(SHARED_DATA_DIR));
  app.use(express.static(PUBLIC_DIR, {
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

  app.use('/vendor/monaco-editor', express.static(path.join(NODE_MODULES_DIR, 'monaco-editor')));
  app.use('/vendor/three', express.static(path.join(NODE_MODULES_DIR, 'three')));
  app.use('/vendor/cytoscape', express.static(path.join(NODE_MODULES_DIR, 'cytoscape')));
  app.use('/vendor/mathjax', express.static(path.join(NODE_MODULES_DIR, 'mathjax')));
  app.use('/vendor/vexflow', express.static(path.join(NODE_MODULES_DIR, 'vexflow')));
  app.use('/vendor/tesseract.js', express.static(path.join(NODE_MODULES_DIR, 'tesseract.js')));
  app.use('/vendor/layout-base', express.static(path.join(NODE_MODULES_DIR, 'layout-base')));
  app.use('/vendor/cytoscape-expand-collapse', express.static(path.join(NODE_MODULES_DIR, 'cytoscape-expand-collapse')));
  app.use('/vendor/cytoscape-fcose', express.static(path.join(NODE_MODULES_DIR, 'cytoscape-fcose')));
  app.use('/vendor/cose-base', express.static(path.join(NODE_MODULES_DIR, 'cose-base')));
  app.use('/vendor/requirejs', express.static(path.join(NODE_MODULES_DIR, 'requirejs')));
  app.use('/vendor/babel', express.static(path.join(PUBLIC_DIR, 'vendor/babel')));
  app.use('/vendor/react', express.static(path.join(PUBLIC_DIR, 'vendor/react')));

  app.use("/api/toolbar", toolbarRoutes(ctx));
  app.use("/api/graph", graphDataRoutes);
  app.use('/api', previewRuntimeRoutes(ctx));
  app.use('/api', previewRuntimeControlRoutes(ctx));
  app.use('/UserSettings', express.static(USER_SETTINGS_DIR));
  app.use('/Notebook', requireAuthentication, express.static(NOTEBOOK_DIR));
  app.use(favicon(path.join(PUBLIC_DIR, 'favicon.ico')));

  await loadRoutes(app, ctx);
  registerNotebookRoutes(app, ctx);
  registerGraphExtras(app, ctx);
  registerGamepadRoutes(app, ctx);
  registerWorldRoutes(app, ctx);

  return app;
}

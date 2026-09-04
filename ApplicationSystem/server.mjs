// Nodevision/ApplicationSystem/server.mjs
// This file initializes the Nodevision Express application and wires core middleware, static asset serving, authentication, and API routes into a single server entry point.

import "./server/nodeWebApiCompat.mjs";
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import favicon from 'serve-favicon';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cookieParser from 'cookie-parser';

import * as AuthService from './Auth/AuthService.mjs';
import { ensureDefaultAdminAccount } from './Auth/userStore.mjs';
import { ensureDeviceIdentity } from './Sync/DeviceIdentity.mjs';

import { createServerContext, ensureServerDirectories } from './shared/serverContext.mjs';

import { createPhpProxyOptions } from "./server/phpProxy.mjs";
import { loadRoutes } from "./server/dynamicRoutes.mjs";
import { identityMiddleware, requireAuthentication } from "./server/middleware/authIdentity.mjs";
import { registerAuthRoutes } from "./server/routes/authRoutes.mjs";

import { registerNotebookRoutes } from "./server/routes/notebookRoutes.mjs";
import { registerGraphExtras } from "./server/routes/graphExtras.mjs";
import { registerGamepadRoutes } from "./server/routes/gamepadRoutes.mjs";
import { registerSoundSettingsRoutes } from "./server/routes/soundSettingsRoutes.mjs";
import { registerAppStylesRoutes } from "./server/routes/appStylesRoutes.mjs";
import { registerWorldRoutes } from "./server/routes/worldRoutes.mjs";
import { registerMetaWorldAssetRoutes } from "./server/routes/metaWorldAssetRoutes.mjs";
import { requireLanViewPermission } from "./routes/api/lanCooperationRoutes.js";
import { registerPeerRoutes } from "./server/routes/peerRoutes.mjs";
import { registerSyncPanelRoutes } from "./server/routes/syncPanelRoutes.mjs";
import { registerBrokerRoutes } from "./server/routes/brokerRoutes.mjs";
import { createDesktopOpenState, registerDesktopOpenRoutes } from "./Desktop/DesktopOpenHandler.mjs";
import { registerTerrainRoutes } from "./server/routes/terrainRoutes.mjs";
import { registerResourcePathRoutes } from "./server/routes/resourcePathRoutes.mjs";
import { registerSectionalMapRoutes } from "./server/routes/sectionalMapRoutes.mjs";
import { registerSpeechRoutes } from "./server/routes/speechRoutes.mjs";
import { registerHandwritingOcrTrainingRoutes } from "./server/routes/handwritingOcrTrainingRoutes.mjs";
import { registerStrokeHandwritingRecognitionRoutes } from "./server/routes/strokeHandwritingRecognitionRoutes.mjs";
import { registerPhoneImportRoutes } from "./server/routes/phoneImportRoutes.mjs";
import { registerNativeHandwritingRoutes } from "./server/handwriting/NativeHandwritingRoutes.mjs";

export default async function createApp(runtimeConfig = {}) {
  const ctx = createServerContext(runtimeConfig);
  ctx.host = runtimeConfig.host;
  ctx.port = runtimeConfig.port;
  ctx.actualPort = runtimeConfig.actualPort;
  ensureServerDirectories(ctx);

  let deviceIdentity;
  try {
    deviceIdentity = await ensureDeviceIdentity({ runtimeRoot: ctx.runtimeRoot });
    console.log('Device identity:', { deviceId: deviceIdentity.deviceId, deviceName: deviceIdentity.deviceName });
  } catch (err) {
    console.error('Failed to initialize device identity:', err);
    throw err;
  }

  try {
    await ensureDefaultAdminAccount();
  } catch (err) {
    console.error('Failed to bootstrap authentication data:', err);
  }

  const NOTEBOOK_DIR = ctx.notebookDir;
  const USER_SETTINGS_DIR = ctx.userSettingsDir;
  const SHARED_DATA_DIR = ctx.sharedDataDir;
  const PUBLIC_DIR = ctx.publicDir;
  const APP_LAYOUTS_DIR = path.resolve(PUBLIC_DIR, '..', 'Layouts');
  const NODE_MODULES_DIR = ctx.nodeModulesDir;

  const desktopOpenState = runtimeConfig.desktopOpenState || await createDesktopOpenState({
    notebookDir: ctx.notebookDir,
    argv: runtimeConfig.desktopOpenArgs || [],
  });

  const app = express();

  // Middleware setup (configure body size limits first)
  app.use('/api/handwriting/native', express.json({ limit: '2mb' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());
  app.use((err, req, res, next) => {
    if (err?.type === "entity.parse.failed") {
      console.warn("[request-json] Invalid JSON body", { path: req.path });
      return res.status(400).json({ error: "Invalid JSON request body" });
    }
    return next(err);
  });

  app.use(identityMiddleware(AuthService));
  registerAuthRoutes(app, AuthService);
  registerPeerRoutes(app, ctx);
  registerSyncPanelRoutes(app, ctx);
  registerBrokerRoutes(app, ctx);
  registerDesktopOpenRoutes(app, ctx, desktopOpenState); 
  registerHandwritingOcrTrainingRoutes(app, ctx);
  registerStrokeHandwritingRecognitionRoutes(app, ctx);
  registerNativeHandwritingRoutes(app, ctx);
  registerPhoneImportRoutes(app, ctx);


  await loadRoutes(app, ctx);

  app.use('/lib/monaco', express.static(path.join(PUBLIC_DIR, 'lib/monaco')));

  app.use('/php', createProxyMiddleware(createPhpProxyOptions(runtimeConfig)));
  app.use('/public/data', express.static(SHARED_DATA_DIR));
  app.use('/Layouts', express.static(APP_LAYOUTS_DIR, {
    etag: false,
    maxAge: 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.mjs') || filePath.endsWith('.js') || filePath.endsWith('.json')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
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
  app.use('/vendor/pdfjs', express.static(path.join(NODE_MODULES_DIR, 'pdfjs-dist')));
  app.use('/vendor/tesseract.js', express.static(path.join(NODE_MODULES_DIR, 'tesseract.js')));
  app.use('/vendor/layout-base', express.static(path.join(NODE_MODULES_DIR, 'layout-base')));
  app.use('/vendor/cytoscape-expand-collapse', express.static(path.join(NODE_MODULES_DIR, 'cytoscape-expand-collapse')));
  app.use('/vendor/cytoscape-fcose', express.static(path.join(NODE_MODULES_DIR, 'cytoscape-fcose')));
  app.use('/vendor/cose-base', express.static(path.join(NODE_MODULES_DIR, 'cose-base')));
  app.use('/vendor/requirejs', express.static(path.join(NODE_MODULES_DIR, 'requirejs')));
  app.use('/vendor/babel', express.static(path.join(PUBLIC_DIR, 'vendor/babel')));
  app.use('/vendor/react', express.static(path.join(PUBLIC_DIR, 'vendor/react')));
  app.use('/UserSettings', express.static(USER_SETTINGS_DIR));
  app.use('/Notebook', requireAuthentication, requireLanViewPermission(ctx), express.static(NOTEBOOK_DIR));
  app.use(favicon(path.join(PUBLIC_DIR, 'favicon.ico')));

  registerNotebookRoutes(app, ctx);
  registerGraphExtras(app, ctx);
  registerGamepadRoutes(app, ctx);
  registerSoundSettingsRoutes(app, ctx);
  registerAppStylesRoutes(app, ctx);
  registerMetaWorldAssetRoutes(app, ctx);
  registerWorldRoutes(app, ctx);
  registerTerrainRoutes(app, ctx);
  registerResourcePathRoutes(app, ctx);
  registerSectionalMapRoutes(app, ctx);
  registerSpeechRoutes(app, ctx);

  return app;
}

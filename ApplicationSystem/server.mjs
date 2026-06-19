// Nodevision/ApplicationSystem/server.mjs
// This file initializes the Nodevision Express application and wires core middleware, static asset serving, authentication, and API routes into a single server entry point.

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import favicon from 'serve-favicon';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cookieParser from 'cookie-parser';

import * as AuthService from './Auth/AuthService.mjs';
import { ensureDefaultAdminAccount } from './Auth/userStore.mjs';
import { ensureDeviceIdentity } from './Sync/DeviceIdentity.mjs';

import toolbarRoutes from "./routes/api/toolbarRoutes.js";
import graphDataRoutes from "./routes/api/graphData.js";
import createExternalGraphRouter from "./routes/api/externalGraph.js";
import listDirectoryRouter from "./routes/api/listDirectory.js";
import uploadRoutes from './routes/api/fileUploadRoutes.js';
import previewRuntimeRoutes from './routes/api/previewRuntimeRoutes.js';
import previewRuntimeControlRoutes from './routes/api/previewRuntimeControlRoutes.js';
import arduinoFlashRoutes from './routes/api/arduinoFlashRoutes.js';
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
import { registerPeerRoutes } from "./server/routes/peerRoutes.mjs";
import { registerSyncPanelRoutes } from "./server/routes/syncPanelRoutes.mjs";
import { registerBrokerRoutes } from "./server/routes/brokerRoutes.mjs";
import { createDesktopOpenState, registerDesktopOpenRoutes } from "./Desktop/DesktopOpenHandler.mjs";

const FAA_VFR_RASTER_CHARTS_URL = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const NODEVISION_KML_HTTP_USER_AGENT = "NodevisionKMLViewer/1.0 local Nodevision app";
const GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000;
const geocodeCache = new Map();

const FAA_SECTIONAL_CENTERS = Object.freeze([
  { name: "Albuquerque", lat: 35.0844, lon: -106.6504 },
  { name: "Anchorage", lat: 61.2181, lon: -149.9003 },
  { name: "Atlanta", lat: 33.7490, lon: -84.3880 },
  { name: "Bethel", lat: 60.7922, lon: -161.7558 },
  { name: "Billings", lat: 45.7833, lon: -108.5007 },
  { name: "Brownsville", lat: 25.9017, lon: -97.4975 },
  { name: "Cape Lisburne", lat: 68.8750, lon: -166.1100 },
  { name: "Charlotte", lat: 35.2271, lon: -80.8431 },
  { name: "Cheyenne", lat: 41.1400, lon: -104.8202 },
  { name: "Chicago", lat: 41.8781, lon: -87.6298 },
  { name: "Cincinnati", lat: 39.1031, lon: -84.5120 },
  { name: "Cold Bay", lat: 55.2046, lon: -162.7181 },
  { name: "Dallas-Ft Worth", lat: 32.7767, lon: -96.7970 },
  { name: "Dawson", lat: 64.0601, lon: -139.4320 },
  { name: "Denver", lat: 39.7392, lon: -104.9903 },
  { name: "Detroit", lat: 42.3314, lon: -83.0458 },
  { name: "Dutch Harbor", lat: 53.8898, lon: -166.5422 },
  { name: "El Paso", lat: 31.7619, lon: -106.4850 },
  { name: "Fairbanks", lat: 64.8378, lon: -147.7164 },
  { name: "Great Falls", lat: 47.5053, lon: -111.3008 },
  { name: "Green Bay", lat: 44.5133, lon: -88.0133 },
  { name: "Halifax", lat: 44.6488, lon: -63.5752 },
  { name: "Hawaiian Islands", lat: 21.3069, lon: -157.8583 },
  { name: "Houston", lat: 29.7604, lon: -95.3698 },
  { name: "Jacksonville", lat: 30.3322, lon: -81.6557 },
  { name: "Juneau", lat: 58.3019, lon: -134.4197 },
  { name: "Kansas City", lat: 39.0997, lon: -94.5786 },
  { name: "Ketchikan", lat: 55.3422, lon: -131.6461 },
  { name: "Klamath Falls", lat: 42.2249, lon: -121.7817 },
  { name: "Kodiak", lat: 57.7900, lon: -152.4072 },
  { name: "Lake Huron", lat: 44.8000, lon: -82.4000 },
  { name: "Las Vegas", lat: 36.1699, lon: -115.1398 },
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { name: "McGrath", lat: 62.9560, lon: -155.5958 },
  { name: "Memphis", lat: 35.1495, lon: -90.0490 },
  { name: "Miami", lat: 25.7617, lon: -80.1918 },
  { name: "Montreal", lat: 45.5017, lon: -73.5673 },
  { name: "New Orleans", lat: 29.9511, lon: -90.0715 },
  { name: "New York", lat: 40.7128, lon: -74.0060 },
  { name: "Nome", lat: 64.5011, lon: -165.4064 },
  { name: "Omaha", lat: 41.2565, lon: -95.9345 },
  { name: "Phoenix", lat: 33.4484, lon: -112.0740 },
  { name: "Point Barrow", lat: 71.2906, lon: -156.7886 },
  { name: "Salt Lake City", lat: 40.7608, lon: -111.8910 },
  { name: "San Antonio", lat: 29.4241, lon: -98.4936 },
  { name: "San Francisco", lat: 37.7749, lon: -122.4194 },
  { name: "Seattle", lat: 47.6062, lon: -122.3321 },
  { name: "Seward", lat: 60.1042, lon: -149.4422 },
  { name: "St. Louis", lat: 38.6270, lon: -90.1994 },
  { name: "Twin Cities", lat: 44.9537, lon: -93.0900 },
  { name: "Washington", lat: 38.9072, lon: -77.0369 },
  { name: "Western Aleutian Islands", lat: 52.5000, lon: 174.0000 },
  { name: "Wichita", lat: 37.6872, lon: -97.3301 },
]);

function numericCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function distanceKm(a, b) {
  const earthRadiusKm = 6371;
  const dLat = degreesToRadians(b.lat - a.lat);
  const dLon = degreesToRadians(b.lon - a.lon);
  const lat1 = degreesToRadians(a.lat);
  const lat2 = degreesToRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizeChartKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safePathSegment(value, fallback = "resource") {
  const safe = String(value || fallback)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
  return safe || fallback;
}

function selectNearestSectional(lat, lon) {
  const coordinate = { lat, lon };
  return FAA_SECTIONAL_CENTERS
    .map((chart) => ({ ...chart, distanceKm: distanceKm(coordinate, chart) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;
}

async function fetchFaaSectionalCatalog() {
  const response = await fetch(FAA_VFR_RASTER_CHARTS_URL, {
    headers: {
      "User-Agent": NODEVISION_KML_HTTP_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error("FAA VFR raster catalog request failed with " + response.status + ".");

  const html = await response.text();
  const catalog = new Map();
  const hrefPattern = /href="([^"]*sectional-files\/[^"]+\.zip)"/gi;
  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    const sourceUrl = new URL(match[1], FAA_VFR_RASTER_CHARTS_URL).toString();
    const filename = decodeURIComponent(new URL(sourceUrl).pathname.split("/").pop() || "sectional.zip");
    const chartName = filename.replace(/\.zip$/i, "").replace(/[_+]+/g, " ").replace(/\s+/g, " ").trim();
    const key = normalizeChartKey(chartName);
    if (key && !catalog.has(key)) catalog.set(key, { chartName, filename, sourceUrl });
  }

  if (!catalog.size) throw new Error("FAA VFR raster catalog did not list sectional GeoTIFF ZIP files.");
  return catalog;
}

function findCatalogEntry(catalog, chartName) {
  const key = normalizeChartKey(chartName);
  if (catalog.has(key)) return catalog.get(key);
  for (const [candidateKey, entry] of catalog.entries()) {
    if (candidateKey.includes(key) || key.includes(candidateKey)) return entry;
  }
  return null;
}

async function downloadSectionalResource(ctx, { lat, lon, name }) {
  const selection = selectNearestSectional(lat, lon);
  if (!selection) throw new Error("No FAA sectional chart could be selected for this coordinate.");

  const catalog = await fetchFaaSectionalCatalog();
  const entry = findCatalogEntry(catalog, selection.name);
  if (!entry) throw new Error("The FAA catalog did not include a GeoTIFF ZIP for " + selection.name + ".");

  const chartSegment = safePathSegment(selection.name, "sectional");
  const filename = safePathSegment(entry.filename || chartSegment + ".zip", chartSegment + ".zip");
  const targetDir = path.join(ctx.notebookDir, "Resources", "Aviation", "Sectionals", chartSegment);
  const targetPath = path.join(targetDir, filename);
  const metadataFilename = filename.replace(/\.zip$/i, "") + ".metadata.json";
  const metadataPath = path.join(targetDir, metadataFilename);

  await fs.mkdir(targetDir, { recursive: true });
  const downloadResponse = await fetch(entry.sourceUrl, {
    headers: {
      "User-Agent": NODEVISION_KML_HTTP_USER_AGENT,
      "Accept": "application/zip,application/octet-stream,*/*",
    },
  });
  if (!downloadResponse.ok) throw new Error("FAA sectional download failed with " + downloadResponse.status + ".");

  if (downloadResponse.body && typeof Readable.fromWeb === "function") {
    await pipeline(Readable.fromWeb(downloadResponse.body), createWriteStream(targetPath));
  } else {
    await fs.writeFile(targetPath, Buffer.from(await downloadResponse.arrayBuffer()));
  }

  const relativePath = path.posix.join("Resources", "Aviation", "Sectionals", chartSegment, filename);
  const metadataRelativePath = path.posix.join("Resources", "Aviation", "Sectionals", chartSegment, metadataFilename);
  const metadata = {
    type: "nodevision-faa-sectional-download",
    chartName: selection.name,
    catalogChartName: entry.chartName,
    selectedName: String(name || "selected feature"),
    selectedCoordinate: { lat, lon },
    nearestChartCenter: {
      lat: selection.lat,
      lon: selection.lon,
      distanceKm: Number(selection.distanceKm.toFixed(1)),
    },
    sourceUrl: entry.sourceUrl,
    resourcePath: relativePath,
    downloadedAt: new Date().toISOString(),
    note: "Official FAA GeoTIFF ZIP saved for conversion. Nodevision aviation basemap display still requires a local XYZ chart pack.",
  };
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  return {
    chartName: selection.name,
    catalogChartName: entry.chartName,
    distanceKm: Number(selection.distanceKm.toFixed(1)),
    path: relativePath,
    metadataPath: metadataRelativePath,
    sourceUrl: entry.sourceUrl,
    note: metadata.note,
  };
}

function registerKmlUtilityRoutes(app, ctx) {
  app.get("/api/kml/geocode", async (req, res) => {
    if (!req.identity) return res.status(401).json({ error: "Authentication required" });
    const query = String(req.query?.q || "").trim();
    if (!query) return res.status(400).json({ error: "Location search query is required" });

    const cacheKey = query.toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < GEOCODE_CACHE_TTL_MS) return res.json(cached.payload);

    try {
      const url = new URL(NOMINATIM_SEARCH_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "5");
      url.searchParams.set("addressdetails", "0");
      const response = await fetch(url, {
        headers: {
          "User-Agent": NODEVISION_KML_HTTP_USER_AGENT,
          "Accept": "application/json",
        },
      });
      if (!response.ok) throw new Error("Geocoder request failed with " + response.status + ".");
      const data = await response.json();
      const results = Array.isArray(data) ? data.map((item) => ({
        displayName: String(item?.display_name || item?.name || query),
        lat: Number(item?.lat),
        lon: Number(item?.lon),
        type: item?.type ? String(item.type) : "",
        category: item?.category ? String(item.category) : "",
        importance: Number.isFinite(Number(item?.importance)) ? Number(item.importance) : null,
      })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon)) : [];
      const payload = {
        ok: true,
        query,
        results,
        attribution: "Location search data from OpenStreetMap Nominatim",
      };
      geocodeCache.set(cacheKey, { createdAt: Date.now(), payload });
      return res.json(payload);
    } catch (err) {
      console.error("KML geocode failed:", err);
      return res.status(502).json({ error: err?.message || "Location search failed" });
    }
  });

  app.post("/api/kml/aviation/download-sectional", async (req, res) => {
    if (!req.identity) return res.status(401).json({ error: "Authentication required" });
    const lat = numericCoordinate(req.body?.lat);
    const lon = numericCoordinate(req.body?.lon);
    if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: "A valid selected pin latitude and longitude are required" });
    }

    try {
      const result = await downloadSectionalResource(ctx, { lat, lon, name: req.body?.name });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error("KML sectional download failed:", err);
      return res.status(502).json({ error: err?.message || "Sectional download failed" });
    }
  });
}


export default async function createApp(runtimeConfig = {}) {
  const ctx = createServerContext(runtimeConfig);
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
  const USER_DATA_DIR = ctx.userDataDir;
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
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  app.use(identityMiddleware(AuthService));
  registerAuthRoutes(app, AuthService);
  registerPeerRoutes(app, ctx);
  registerSyncPanelRoutes(app, ctx);
  registerBrokerRoutes(app, ctx);
  registerDesktopOpenRoutes(app, ctx, desktopOpenState);
  registerKmlUtilityRoutes(app, ctx);


  // Public login background asset (optional).
  // NOTE: This intentionally serves *only* the one curated SVG, not the entire ServerData directory.
  async function resolveLoginBackgroundSvg() {
    const candidates = [
      path.join(ctx.serverDataDir, 'NotebookLoginBackground.svg'),
      // Common dev runtime when NODEVISION_ROOT isn't wired as expected.
      path.resolve(process.cwd(), 'ServerData', 'NotebookLoginBackground.svg'),
      // Common install/runtime default.
      path.join(os.homedir(), 'Nodevision', 'ServerData', 'NotebookLoginBackground.svg'),
    ];

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return { path: candidate, candidates };
      } catch {
        // try next
      }
    }
    return { path: null, candidates };
  }

  function setNoCache(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  async function sendLoginBackgroundSvg(req, res) {
    const resolved = await resolveLoginBackgroundSvg();
    if (!resolved.path) {
      console.warn('[login-background] Missing NotebookLoginBackground.svg. Looked in:', resolved.candidates);
      setNoCache(res);
      return res.status(404).type('text/plain').send('NotebookLoginBackground.svg not found');
    }

    setNoCache(res);
    return res.sendFile(resolved.path);
  }

  app.head('/ServerData/NotebookLoginBackground.svg', async (req, res) => {
    const resolved = await resolveLoginBackgroundSvg();
    setNoCache(res);
    if (!resolved.path) return res.status(404).end();
    return res.status(200).end();
  });

  app.get('/ServerData/NotebookLoginBackground.svg', sendLoginBackgroundSvg);

  // Debug helper (no auth): shows where the server is looking for the asset.
  app.get('/api/loginBackground/status', async (req, res) => {
    const resolved = await resolveLoginBackgroundSvg();
    return res.json({
      found: Boolean(resolved.path),
      resolvedPath: resolved.path,
      candidates: resolved.candidates,
    });
  });

  app.use(/^\/ServerSettings(\/|$)/i, (req, res) => {
    return res.status(403).json({ error: 'Forbidden' });
  });

app.use('/lib/monaco', express.static(path.join(PUBLIC_DIR, 'lib/monaco')));
app.use("/api", listDirectoryRouter(ctx));
app.use("/api", arduinoFlashRoutes(ctx));
app.use('/api/file', uploadRoutes);


  // Authenticated write access for curated ServerData assets.
  // Currently limited to the login background SVG.
  app.post('/api/serverData/save', async (req, res) => {
    if (!req.identity) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      path: requestedPath,
      content,
      encoding = 'utf8',
      bom = false,
    } = req.body || {};

    if (content === undefined) {
      return res.status(400).json({ error: 'File content is required' });
    }

    const normalized = String(requestedPath || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

    const allowed = new Set([
      'ServerData/NotebookLoginBackground.svg',
      'NotebookLoginBackground.svg',
    ]);
    if (!allowed.has(normalized)) {
      return res.status(400).json({ error: 'Invalid ServerData save path' });
    }

    const filePath = path.join(ctx.serverDataDir, 'NotebookLoginBackground.svg');
    try {
      await fs.mkdir(ctx.serverDataDir, { recursive: true });

      let buf;
      if (encoding === 'base64') {
        buf = Buffer.from(String(content || ''), 'base64');
      } else {
        buf = Buffer.from(String(content ?? ''), encoding);
      }

      if (bom && (encoding === 'utf8' || encoding === 'utf-8')) {
        const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
        buf = Buffer.concat([utf8Bom, buf]);
      }

      await fs.writeFile(filePath, buf);
      return res.json({ success: true, path: normalized });
    } catch (err) {
      console.error('Error saving ServerData asset:', err);
      return res.status(500).json({ error: 'Error saving ServerData asset' });
    }
  });

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
  app.use("/api/graph", createExternalGraphRouter(ctx));
  app.use('/api', previewRuntimeRoutes(ctx));
  app.use('/api', previewRuntimeControlRoutes(ctx));
  app.use('/UserSettings', express.static(USER_SETTINGS_DIR));
  app.use('/Notebook', requireAuthentication, express.static(NOTEBOOK_DIR));
  app.use(favicon(path.join(PUBLIC_DIR, 'favicon.ico')));

  await loadRoutes(app, ctx);
  registerNotebookRoutes(app, ctx);
  registerGraphExtras(app, ctx);
  registerGamepadRoutes(app, ctx);
  registerSoundSettingsRoutes(app, ctx);
  registerAppStylesRoutes(app, ctx);
  registerMetaWorldAssetRoutes(app, ctx);
  registerWorldRoutes(app, ctx);

  return app;
}

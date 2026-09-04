// Nodevision/ApplicationSystem/routes/api/kmlUtilityRoutes.js
// This route provides KML geocoding helpers and aviation sectional downloads for map viewers.

import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { createServerContext } from "../../shared/serverContext.mjs";
import { discoverFaaSectionalCatalog as discoverSectionalCatalogFromFaa } from "../../Aviation/SectionalMaps/FaaSectionalProvider.mjs";
import { loadSectionalMapSettings, resolveSectionalMapsDirectory } from "../../Aviation/SectionalMaps/SectionalMapSettings.mjs";
import { FAA_SECTIONAL_CENTERS } from "../../Aviation/SectionalMaps/FaaSectionalCenters.mjs";

const BASE_CONTEXT = createServerContext();
const FAA_VFR_RASTER_CHARTS_URL = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const NODEVISION_KML_HTTP_USER_AGENT = "NodevisionKMLViewer/1.0 local Nodevision app";
const GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000;
const geocodeCache = new Map();

function numericCoordinate(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }

function distanceKm(a, b) {
  const [dLat, dLon, lat1, lat2] = [b.lat - a.lat, b.lon - a.lon, a.lat, b.lat].map((value) => value * Math.PI / 180);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
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
  const catalog = await discoverSectionalCatalogFromFaa({ url: FAA_VFR_RASTER_CHARTS_URL });
  return new Map(catalog.charts.map((chart) => [normalizeChartKey(chart.chartName), chart]));
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

  const settings = await loadSectionalMapSettings(ctx);
  const resolved = await resolveSectionalMapsDirectory(ctx, settings.sectionalMapsDirectory);
  const chartSegment = safePathSegment(selection.name, "sectional");
  const filename = safePathSegment(entry.filename || chartSegment + ".zip", chartSegment + ".zip");
  const targetDir = resolved.absoluteDirectory;
  const targetPath = path.join(targetDir, filename);
  const metadataFilename = chartSegment + ".metadata.json";
  const metadataPath = path.join(targetDir, metadataFilename);

  await fs.mkdir(targetDir, { recursive: true });
  const downloadResponse = await fetch(entry.sourceUrl, {
    headers: { "User-Agent": NODEVISION_KML_HTTP_USER_AGENT, "Accept": "application/zip,application/octet-stream,*/*" },
  });
  if (!downloadResponse.ok) throw new Error("FAA sectional download failed with " + downloadResponse.status + ".");

  const tempPath = targetPath + ".tmp";
  try {
    if (downloadResponse.body && typeof Readable.fromWeb === "function") {
      await pipeline(Readable.fromWeb(downloadResponse.body), createWriteStream(tempPath, { flags: "wx" }));
    } else {
      await fs.writeFile(tempPath, Buffer.from(await downloadResponse.arrayBuffer()), { flag: "wx" });
    }
    await fs.rename(tempPath, targetPath);
  } catch (err) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw err;
  }

  const relativePath = path.posix.join(resolved.relativeDirectory, filename);
  const metadataRelativePath = path.posix.join(resolved.relativeDirectory, metadataFilename);
  const metadata = {
    type: "nodevision-faa-sectional-download",
    chartName: selection.name,
    catalogChartName: entry.chartName,
    selectedName: String(name || "selected feature"),
    selectedCoordinate: { lat, lon },
    nearestChartCenter: { lat: selection.lat, lon: selection.lon, distanceKm: Number(selection.distanceKm.toFixed(1)) },
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

export default function createKmlUtilityRoutes(ctx = BASE_CONTEXT) {
  const router = express.Router();

  router.get("/kml/geocode", async (req, res) => {
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
        headers: { "User-Agent": NODEVISION_KML_HTTP_USER_AGENT, "Accept": "application/json" },
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
      const payload = { ok: true, query, results, attribution: "Location search data from OpenStreetMap Nominatim" };
      geocodeCache.set(cacheKey, { createdAt: Date.now(), payload });
      return res.json(payload);
    } catch (err) {
      console.error("KML geocode failed:", err);
      return res.status(502).json({ error: err?.message || "Location search failed" });
    }
  });

  router.post("/kml/aviation/download-sectional", async (req, res) => {
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

  return router;
}

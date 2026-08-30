// Nodevision/ApplicationSystem/Aviation/SectionalMaps/SectionalMapUpdater.mjs
// This module updates user-owned FAA sectional GeoTIFF ZIP collections through staged, explicit downloads.

import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { discoverFaaSectionalCatalog, NODEVISION_FAA_USER_AGENT } from "./FaaSectionalProvider.mjs";
import { getSectionalMapsDirectory } from "./SectionalMapSettings.mjs";
import { isMetadataCurrent, loadSectionalMetadata, makeSectionalMetadata, saveSectionalMetadata } from "./SectionalMapMetadata.mjs";

function safeFilename(filename, fallback) {
  const base = path.basename(String(filename || fallback || "sectional.zip"));
  const clean = base.replace(/[^a-zA-Z0-9._ -]+/g, "_").replace(/\s+/g, " ").trim();
  return /\.zip$/i.test(clean) ? clean : `${clean || "sectional"}.zip`;
}

async function listFiles(directory) {
  try {
    return await fs.readdir(directory);
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

function chartFilesPresent(metadata, files) {
  const available = new Set(files);
  return (metadata?.charts || []).every((chart) => available.has(chart.filename));
}

export function createSectionalMapUpdatePlan({ metadata, catalog, files = [] }) {
  const current = isMetadataCurrent(metadata, catalog) && chartFilesPresent(metadata, files);
  return {
    action: current ? "current" : "update",
    localEdition: metadata?.edition || null,
    localEditionLabel: metadata?.editionLabel || metadata?.edition || null,
    remoteEdition: catalog.edition,
    remoteEditionLabel: catalog.editionLabel,
    charts: current ? [] : catalog.charts,
    total: current ? 0 : catalog.charts.length,
  };
}

async function fetchZip(chart, { fetchImpl, signal }) {
  const response = await fetchImpl(chart.sourceUrl, {
    signal,
    headers: {
      "User-Agent": NODEVISION_FAA_USER_AGENT,
      "Accept": "application/zip,application/octet-stream,*/*",
    },
  });
  if (!response?.ok) throw new Error(`${chart.chartName} download failed with ${response?.status || "no response"}.`);
  return response;
}

async function writeResponseBody(response, tmpPath) {
  if (response.body && typeof Readable.fromWeb === "function") {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(tmpPath, { flags: "wx" }));
  } else {
    await fs.writeFile(tmpPath, Buffer.from(await response.arrayBuffer()), { flag: "wx" });
  }
  const stat = await fs.stat(tmpPath);
  if (!stat.size) throw new Error("Downloaded FAA chart package was empty.");
}

async function downloadChartToStaging(chart, stagingDir, options) {
  const filename = safeFilename(chart.filename, `${chart.chartName}.zip`);
  const readyPath = path.join(stagingDir, filename);
  const tmpPath = readyPath + ".tmp";
  const response = await fetchZip(chart, options);
  await writeResponseBody(response, tmpPath);
  await fs.rename(tmpPath, readyPath);
  return { ...chart, filename, stagedPath: readyPath };
}

async function publishStagedCharts(directory, stagedCharts) {
  for (const chart of stagedCharts) {
    await fs.rename(chart.stagedPath, path.join(directory, chart.filename));
  }
}

export async function updateSectionalMaps(ctx, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const logger = options.logger || console;
  const resolved = await getSectionalMapsDirectory(ctx);
  logger.info?.("[sectionals] update requested", { directory: resolved.relativeDirectory });

  if (options.createDirectory) await fs.mkdir(resolved.absoluteDirectory, { recursive: true });
  const stat = await fs.stat(resolved.absoluteDirectory).catch((err) => {
    if (err?.code === "ENOENT") return null;
    throw err;
  });
  if (!stat?.isDirectory?.()) throw new Error("Configured Sectional Maps Directory does not exist.");

  options.onProgress?.({ state: "checking", message: "Checking FAA sectional chart publication", progress: 0.02 });
  const catalog = await discoverFaaSectionalCatalog({ fetchImpl });
  const metadata = await loadSectionalMetadata(resolved.absoluteDirectory);
  const files = await listFiles(resolved.absoluteDirectory);
  const plan = createSectionalMapUpdatePlan({ metadata, catalog, files });
  logger.info?.("[sectionals] catalog discovered", { remoteEdition: catalog.edition, localEdition: metadata?.edition || null, charts: catalog.charts.length });

  if (plan.action === "current") {
    options.onProgress?.({ state: "current", message: "Sectional maps are already current.", progress: 1 });
    return { ok: true, status: "current", directory: resolved.relativeDirectory, edition: catalog.edition, editionLabel: catalog.editionLabel, charts: catalog.charts.length };
  }

  const stagingDir = path.join(resolved.absoluteDirectory, `.nodevision-sectionals-staging-${Date.now()}`);
  const stagedCharts = [];
  try {
    await fs.mkdir(stagingDir, { recursive: true });
    for (let index = 0; index < catalog.charts.length; index += 1) {
      if (options.signal?.aborted) throw new Error("Sectional map update was cancelled.");
      const chart = catalog.charts[index];
      options.onProgress?.({ state: "downloading", chartName: chart.chartName, complete: index, total: catalog.charts.length, progress: 0.08 + (index / catalog.charts.length) * 0.82 });
      stagedCharts.push(await downloadChartToStaging(chart, stagingDir, { fetchImpl, signal: options.signal }));
    }
    options.onProgress?.({ state: "publishing", message: "Publishing completed FAA chart packages", progress: 0.94 });
    await publishStagedCharts(resolved.absoluteDirectory, stagedCharts);
    await saveSectionalMetadata(resolved.absoluteDirectory, makeSectionalMetadata(catalog, stagedCharts));
    await fs.rm(stagingDir, { recursive: true, force: true });
    options.onProgress?.({ state: "complete", message: "Sectional maps updated successfully.", progress: 1 });
    logger.info?.("[sectionals] update complete", { edition: catalog.edition, charts: stagedCharts.length });
    return { ok: true, status: "updated", directory: resolved.relativeDirectory, edition: catalog.edition, editionLabel: catalog.editionLabel, charts: stagedCharts.length };
  } catch (err) {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    logger.error?.("[sectionals] update failed", err);
    throw err;
  }
}

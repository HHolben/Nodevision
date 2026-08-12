// Nodevision/ApplicationSystem/Aviation/SectionalMaps/Tests/SectionalMaps.test.mjs
// This test file verifies FAA Sectional settings, catalog parsing, and staged update behavior without live network access.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFaaSectionalCatalogHtml } from "../FaaSectionalProvider.mjs";
import { saveSectionalMetadata } from "../SectionalMapMetadata.mjs";
import { createSectionalMapUpdatePlan, updateSectionalMaps } from "../SectionalMapUpdater.mjs";
import { getSectionalMapsDirectory, loadSectionalMapSettings, normalizeSectionalMapsDirectory, resolveSectionalMapsDirectory, saveSectionalMapSettings } from "../SectionalMapSettings.mjs";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
const faaHtml = await fs.readFile(path.join(fixtureDir, "fixtures", "faa-vfr-sectionals.html"), "utf8");

async function makeContext() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sectionals-"));
  const ctx = {
    runtimeRoot: root,
    notebookDir: path.join(root, "Notebook"),
    userSettingsDir: path.join(root, "UserSettings"),
  };
  await fs.mkdir(ctx.notebookDir, { recursive: true });
  await fs.mkdir(ctx.userSettingsDir, { recursive: true });
  return ctx;
}

function responseText(text) {
  return { ok: true, status: 200, text: async () => text };
}

function responseZip(bytes = [80, 75, 3, 4, 1]) {
  return { ok: true, status: 200, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
}

function fakeFetch({ failDownloads = false } = {}) {
  return async (url) => {
    if (String(url).includes("digital_products/vfr")) return responseText(faaHtml);
    if (failDownloads) return { ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) };
    return responseZip();
  };
}

async function testPathHandlingAndSettings() {
  const accepted = normalizeSectionalMapsDirectory("Library/Collection3_Atlases/Section2_SectionalMaps");
  assert.equal(accepted, "Library/Collection3_Atlases/Section2_SectionalMaps");
  assert.throws(() => normalizeSectionalMapsDirectory("../../outside"), /traversal/i);

  const ctx = await makeContext();
  await saveSectionalMapSettings(ctx, { sectionalMapsDirectory: accepted });
  const loaded = await loadSectionalMapSettings(ctx);
  assert.equal(loaded.sectionalMapsDirectory, accepted);
  const resolved = await resolveSectionalMapsDirectory(ctx, loaded.sectionalMapsDirectory);
  assert.equal(resolved.absoluteDirectory, path.join(ctx.notebookDir, accepted));
  const accessorResolved = await getSectionalMapsDirectory(ctx);
  assert.equal(accessorResolved.relativeDirectory, accepted);
  const pastedAbsolute = await resolveSectionalMapsDirectory(ctx, path.join(ctx.notebookDir, accepted));
  assert.equal(pastedAbsolute.relativeDirectory, accepted);
  await assert.rejects(() => resolveSectionalMapsDirectory(ctx, path.join(os.tmpdir(), "outside-sectionals")), /outside/i);
}

function testFaaParsingAndPlanning() {
  const catalog = parseFaaSectionalCatalogHtml(faaHtml);
  assert.equal(catalog.edition, "08-06-2026");
  assert.equal(catalog.charts.length, 3);
  assert(catalog.charts.some((chart) => chart.chartName === "Atlanta"));
  assert.throws(() => parseFaaSectionalCatalogHtml("<html></html>"), /did not list/i);

  const metadata = {
    provider: "FAA",
    edition: "08-06-2026",
    charts: catalog.charts.map((chart) => ({ filename: chart.filename })),
  };
  const current = createSectionalMapUpdatePlan({ metadata, catalog, files: catalog.charts.map((chart) => chart.filename) });
  assert.equal(current.action, "current");

  const stale = createSectionalMapUpdatePlan({ metadata: { ...metadata, edition: "07-09-2026" }, catalog, files: [] });
  assert.equal(stale.action, "update");
}

async function testNoUpdateWhenAlreadyCurrent() {
  const ctx = await makeContext();
  await saveSectionalMapSettings(ctx, { sectionalMapsDirectory: "Library/Sectionals" });
  const directory = path.join(ctx.notebookDir, "Library", "Sectionals");
  await fs.mkdir(directory, { recursive: true });
  const catalog = parseFaaSectionalCatalogHtml(faaHtml);
  for (const chart of catalog.charts) await fs.writeFile(path.join(directory, chart.filename), "zip");
  await saveSectionalMetadata(directory, { provider: "FAA", edition: catalog.edition, editionLabel: catalog.editionLabel, charts: catalog.charts.map((chart) => ({ filename: chart.filename })) });

  let zipRequests = 0;
  const result = await updateSectionalMaps(ctx, {
    fetchImpl: async (url) => {
      if (String(url).includes("digital_products/vfr")) return responseText(faaHtml);
      zipRequests += 1;
      return responseZip();
    },
  });
  assert.equal(result.status, "current");
  assert.equal(zipRequests, 0);
}

async function testFailedDownloadPreservesExistingFiles() {
  const ctx = await makeContext();
  await saveSectionalMapSettings(ctx, { sectionalMapsDirectory: "Library/Sectionals" });
  const directory = path.join(ctx.notebookDir, "Library", "Sectionals");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "Atlanta.zip"), "old chart");
  await saveSectionalMetadata(directory, { provider: "FAA", edition: "07-09-2026", charts: [{ filename: "Atlanta.zip" }] });

  await assert.rejects(() => updateSectionalMaps(ctx, { fetchImpl: fakeFetch({ failDownloads: true }) }), /download failed/i);
  assert.equal(await fs.readFile(path.join(directory, "Atlanta.zip"), "utf8"), "old chart");
  const entries = await fs.readdir(directory);
  assert(!entries.some((entry) => entry.endsWith(".tmp")), "temporary downloads should not become visible chart files");
  const metadata = JSON.parse(await fs.readFile(path.join(directory, ".nodevision-sectionals.json"), "utf8"));
  assert.equal(metadata.edition, "07-09-2026");
}

async function testSuccessfulUpdatePublishesMetadataAfterDownloads() {
  const ctx = await makeContext();
  await saveSectionalMapSettings(ctx, { sectionalMapsDirectory: "Library/Sectionals" });
  const result = await updateSectionalMaps(ctx, { createDirectory: true, fetchImpl: fakeFetch() });
  const directory = path.join(ctx.notebookDir, "Library", "Sectionals");
  assert.equal(result.status, "updated");
  assert.equal(result.charts, 3);
  assert.equal((await fs.readdir(directory)).filter((name) => /\.zip$/i.test(name)).length, 3);
  const metadata = JSON.parse(await fs.readFile(path.join(directory, ".nodevision-sectionals.json"), "utf8"));
  assert.equal(metadata.edition, "08-06-2026");
  assert.equal(metadata.chartCount, 3);
}

await testPathHandlingAndSettings();
testFaaParsingAndPlanning();
await testNoUpdateWhenAlreadyCurrent();
await testFailedDownloadPreservesExistingFiles();
await testSuccessfulUpdatePublishesMetadataAfterDownloads();
console.log("FAA Sectional Maps tests passed.");

// Nodevision/ApplicationSystem/Aviation/SectionalMaps/SectionalMapMetadata.mjs
// This module reads and writes Nodevision-owned metadata beside user-owned FAA sectional chart files.

import path from "node:path";
import fs from "node:fs/promises";

export const SECTIONAL_METADATA_FILENAME = ".nodevision-sectionals.json";

export async function loadSectionalMetadata(directory) {
  try {
    const data = JSON.parse(await fs.readFile(path.join(directory, SECTIONAL_METADATA_FILENAME), "utf8"));
    return data && typeof data === "object" ? data : null;
  } catch (err) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) return null;
    throw err;
  }
}

export async function saveSectionalMetadata(directory, metadata) {
  const target = path.join(directory, SECTIONAL_METADATA_FILENAME);
  const temp = target + ".tmp";
  await fs.writeFile(temp, JSON.stringify(metadata, null, 2) + "\n");
  await fs.rename(temp, target);
}

export function makeSectionalMetadata(catalog, charts) {
  return {
    type: "nodevision-faa-sectionals",
    provider: "FAA",
    edition: catalog.edition,
    editionLabel: catalog.editionLabel,
    updatedAt: new Date().toISOString(),
    chartCount: charts.length,
    charts: charts.map((chart) => ({
      chartName: chart.chartName,
      filename: chart.filename,
      sourceUrl: chart.sourceUrl,
    })),
  };
}

export function isMetadataCurrent(metadata, catalog) {
  if (!metadata || metadata.provider !== "FAA") return false;
  if (metadata.edition !== catalog.edition) return false;
  const known = new Set((metadata.charts || []).map((chart) => String(chart.filename || "")));
  return (catalog.charts || []).every((chart) => known.has(chart.filename));
}

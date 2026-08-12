// Nodevision/ApplicationSystem/Aviation/SectionalMaps/SectionalMapStatus.mjs
// This module reports local FAA sectional-map directory status without guessing hidden application state from filenames alone.

import fs from "node:fs/promises";
import path from "node:path";
import { loadSectionalMetadata } from "./SectionalMapMetadata.mjs";

async function listZipFiles(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.zip$/i.test(entry.name) && !/\.tmp$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

export async function getSectionalMapDirectoryStatus(directory) {
  let stat = null;
  try {
    stat = await fs.stat(directory);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  const exists = Boolean(stat);
  const isDirectory = Boolean(stat?.isDirectory?.());
  const zipFiles = isDirectory ? await listZipFiles(directory) : null;
  const metadata = isDirectory ? await loadSectionalMetadata(directory) : null;

  return {
    exists,
    isDirectory,
    packageCount: Array.isArray(zipFiles) ? zipFiles.length : 0,
    metadata,
    edition: metadata?.edition || null,
    editionLabel: metadata?.editionLabel || metadata?.edition || null,
    updatedAt: metadata?.updatedAt || null,
    metadataPath: path.join(directory, ".nodevision-sectionals.json"),
  };
}

export async function ensureSectionalMapDirectory(directory) {
  await fs.mkdir(directory, { recursive: true });
  return getSectionalMapDirectoryStatus(directory);
}

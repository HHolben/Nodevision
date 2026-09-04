// Nodevision/ApplicationSystem/server/graph/DirectoryAppearanceStore.mjs
// This module reads, writes, and remaps persistent directory appearance metadata in Nodevision's graph user-data store.

import fs from "node:fs/promises";
import path from "node:path";
import {
  normalizeDirectoryMetadataPath,
  remapDirectoryAppearanceManifest,
  sanitizeDirectoryAppearance,
  sanitizeDirectoryAppearanceManifest,
  setDirectoryAppearanceInManifest,
} from "../../public/GraphManagement/DirectoryAppearanceMetadata.mjs";



async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw || "{}");
  } catch (err) {
    if (err?.code === "ENOENT") return {};
    throw err;
  }
}

async function writeManifest(filePath, manifest) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = filePath + ".tmp-" + process.pid + "-" + Date.now();
  await fs.writeFile(tempPath, JSON.stringify(manifest, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

export async function readDirectoryAppearanceManifest(ctx) {
  const { filePath } = directoryAppearancePaths(ctx);
  return sanitizeDirectoryAppearanceManifest(await readJsonFile(filePath));
}

export async function saveDirectoryAppearance(ctx, pathValue, appearanceValue) {
  const { filePath } = directoryAppearancePaths(ctx);
  const current = sanitizeDirectoryAppearanceManifest(await readJsonFile(filePath));
  const manifest = setDirectoryAppearanceInManifest(current, pathValue, appearanceValue);
  await writeManifest(filePath, manifest);

  const cleanPath = normalizeDirectoryMetadataPath(pathValue);
  return {
    manifest,
    path: cleanPath,
    appearance: sanitizeDirectoryAppearance(manifest.directories[cleanPath]?.appearance || {}),
  };
}

export async function remapDirectoryAppearancePath(ctx, oldPathValue, newPathValue) {
  const { filePath } = directoryAppearancePaths(ctx);
  const current = sanitizeDirectoryAppearanceManifest(await readJsonFile(filePath));
  const manifest = remapDirectoryAppearanceManifest(current, oldPathValue, newPathValue);
  const changed = JSON.stringify(current) !== JSON.stringify(manifest);
  if (changed) await writeManifest(filePath, manifest);
  return { changed, manifest };
}

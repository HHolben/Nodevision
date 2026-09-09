// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDirectoryImages.mjs
// Shared File Manager directory-image resolution and compatibility fallback probing.

import { incrementPerformanceCounter } from "../../PerformanceDiagnostics.mjs";

export const DIRECTORY_IMAGE_CANDIDATES = [
  ".directory.svg",
  "directory.svg",
  ".directory.png",
  "directory.png",
];

const directoryImageCache = new Map();

function normalizeDirectoryPath(value = "") {
  return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/");
}

export function directoryImageMetadataIsDefinitive(entry) {
  if (!entry?.isDirectory || typeof entry !== "object") return false;
  return (
    Object.prototype.hasOwnProperty.call(entry, "directoryImageName") &&
    Object.prototype.hasOwnProperty.call(entry, "directoryImageUrl")
  );
}

export function resolveDirectoryImageUrl(entry) {
  if (!entry || typeof entry !== "object") return "";
  const direct = typeof entry.directoryImageUrl === "string" ? entry.directoryImageUrl.trim() : "";
  if (direct) return direct;

  const name = typeof entry.directoryImageName === "string" ? entry.directoryImageName.trim() : "";
  const relPath = typeof entry.path === "string" ? entry.path : "";
  if (!name || !relPath) return "";

  const normalized = normalizeDirectoryPath(relPath);
  const parts = normalized.split("/").filter(Boolean).map(encodeURIComponent);
  parts.push(encodeURIComponent(name));
  return `/Notebook/${parts.join("/")}`;
}

export function shouldProbeDirectoryImageFallback(entry) {
  if (!entry?.isDirectory) return false;
  if (resolveDirectoryImageUrl(entry)) return false;
  return !directoryImageMetadataIsDefinitive(entry);
}

export async function findDirectoryImageUrl(entry, options = {}) {
  if (!entry?.isDirectory) return "";

  const cacheKey = normalizeDirectoryPath(entry.path || entry.name || "");
  if (directoryImageCache.has(cacheKey)) return directoryImageCache.get(cacheKey) || "";

  const direct = resolveDirectoryImageUrl(entry);
  if (direct) {
    directoryImageCache.set(cacheKey, direct);
    return direct;
  }

  if (!shouldProbeDirectoryImageFallback(entry)) {
    directoryImageCache.set(cacheKey, "");
    incrementPerformanceCounter("FileManager.directoryImageFallbackSkipped");
    return "";
  }

  if (!cacheKey) {
    directoryImageCache.set(cacheKey, "");
    return "";
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    directoryImageCache.set(cacheKey, "");
    return "";
  }

  for (const candidate of DIRECTORY_IMAGE_CANDIDATES) {
    const guessUrl = resolveDirectoryImageUrl({ path: cacheKey, directoryImageName: candidate });
    if (!guessUrl) continue;
    try {
      incrementPerformanceCounter("FileManager.directoryImageFallbackProbes");
      const res = await fetchImpl(guessUrl, { method: "HEAD", cache: "no-store" });
      if (res.ok) {
        directoryImageCache.set(cacheKey, guessUrl);
        return guessUrl;
      }
    } catch {
      // Ignore network errors and try next candidate.
    }
  }

  directoryImageCache.set(cacheKey, "");
  return "";
}

export function clearDirectoryImageCache() {
  directoryImageCache.clear();
}

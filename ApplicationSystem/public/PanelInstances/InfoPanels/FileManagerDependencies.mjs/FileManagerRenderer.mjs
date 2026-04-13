// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerRenderer.mjs
// This file defines browser-side File Manager Renderer logic for the Nodevision UI. It renders interface components and handles user interactions.
import { attachSelectionHandlers } from "./FileManagerSelection.mjs";
import { attachDragDrop } from "./FileManagerDragDrop.mjs";

const DIRECTORY_IMAGE_CANDIDATES = [
  ".directory.svg",
  "directory.svg",
  ".directory.png",
  "directory.png"
];
const directoryImageCache = new Map();

function resolveDirectoryImageUrl(entry) {
  if (!entry || typeof entry !== "object") return "";
  const direct = typeof entry.directoryImageUrl === "string" ? entry.directoryImageUrl.trim() : "";
  if (direct) return direct;

  const name = typeof entry.directoryImageName === "string" ? entry.directoryImageName.trim() : "";
  const relPath = typeof entry.path === "string" ? entry.path : "";
  if (!name || !relPath) return "";

  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean).map(encodeURIComponent);
  parts.push(encodeURIComponent(name));
  return `/Notebook/${parts.join("/")}`;
}

function tokenizeName(value) {
  return String(value ?? "")
    .split(/(\d+)/)
    .filter(Boolean)
    .map((part) => {
      const isNumber = /^\d+$/.test(part);
      return {
        raw: part,
        isNumber,
        number: isNumber ? Number(part) : null,
        text: isNumber ? null : part.toLowerCase()
      };
    });
}

function naturalCompareEntries(a, b) {
  const tokensA = tokenizeName(a?.name);
  const tokensB = tokenizeName(b?.name);
  const max = Math.max(tokensA.length, tokensB.length);

  for (let i = 0; i < max; i += 1) {
    const tokA = tokensA[i];
    const tokB = tokensB[i];
    if (!tokA && tokB) return -1;
    if (!tokB && tokA) return 1;
    if (!tokA && !tokB) return 0;

    if (tokA.isNumber && tokB.isNumber) {
      if (tokA.number !== tokB.number) return tokA.number - tokB.number;
      continue;
    }

    if (tokA.isNumber !== tokB.isNumber) {
      return tokA.isNumber ? -1 : 1; // numbers before letters
    }

    const cmp = tokA.text.localeCompare(tokB.text);
    if (cmp !== 0) return cmp;
  }

  return 0;
}

function applyDirectoryImageIcon(icon, url) {
  if (!icon || !url) return;
  icon.textContent = "";
  icon.style.backgroundImage = `url("${url}")`;
  icon.style.backgroundSize = "cover";
  icon.style.backgroundPosition = "center";
  icon.style.backgroundRepeat = "no-repeat";
  icon.style.border = "1px solid rgba(0,0,0,0.2)";
  icon.style.borderRadius = "3px";
}

function applyEmojiIcon(icon, emoji) {
  if (!icon) return;
  icon.style.backgroundImage = "";
  icon.style.backgroundSize = "";
  icon.style.backgroundPosition = "";
  icon.style.backgroundRepeat = "";
  icon.style.border = "";
  icon.textContent = emoji;
  icon.style.fontSize = "14px";
  icon.style.lineHeight = "1";
}

async function findDirectoryImageUrl(entry) {
  if (!entry?.isDirectory) return "";

  const cacheKey = String(entry.path || entry.name || "").replace(/^\/+/, "").replace(/\\/g, "/");
  if (directoryImageCache.has(cacheKey)) {
    return directoryImageCache.get(cacheKey) || "";
  }

  const direct = resolveDirectoryImageUrl(entry);
  if (direct) {
    directoryImageCache.set(cacheKey, direct);
    return direct;
  }

  if (!cacheKey) {
    directoryImageCache.set(cacheKey, "");
    return "";
  }

  for (const candidate of DIRECTORY_IMAGE_CANDIDATES) {
    const guessUrl = resolveDirectoryImageUrl({ path: cacheKey, directoryImageName: candidate });
    if (!guessUrl) continue;
    try {
      const res = await fetch(guessUrl, { method: "HEAD", cache: "no-store" });
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

export function renderFiles(state, files) {
  const list = state.panelElem.querySelector("#file-list");
  list.innerHTML = "";

  const sortedFiles = [...files].sort(naturalCompareEntries);

  sortedFiles.forEach(file => {
    const li = document.createElement("li");
    const link = document.createElement("a");

    link.href = "#";
    link.dataset.fullPath =
      state.currentPath ? `${state.currentPath}/${file.name}` : file.name;

    const icon = document.createElement("span");
    icon.style.display = "inline-flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.width = "20px";
    icon.style.height = "20px";
    icon.style.flex = "0 0 20px";
    icon.style.marginRight = "6px";

    const directoryImageUrl = file.isDirectory ? resolveDirectoryImageUrl(file) : "";
    if (directoryImageUrl) {
      applyDirectoryImageIcon(icon, directoryImageUrl);
    } else {
      applyEmojiIcon(icon, file.isDirectory ? "📁" : "🖹");
      if (file.isDirectory) {
        findDirectoryImageUrl(file).then((url) => {
          if (url) applyDirectoryImageIcon(icon, url);
        });
      }
    }

    const label = document.createElement("span");
    label.textContent = file.name;

    link.appendChild(icon);
    link.appendChild(label);
    link.href = "#";

    li.appendChild(link);
    list.appendChild(li);

    attachSelectionHandlers(state, link);
    attachDragDrop(state, link, file);
  });
}

// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerCore.mjs
// This file defines browser-side File Manager Core logic for the Nodevision UI. It renders interface components and handles user interactions.

import { updateToolbarState } from '/panels/createToolbar.mjs';
import { moveFileOrDirectory as moveFileOrDirectoryAPI } from '/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerAPI.mjs';
import { maybePromptLinkMoveImpact } from '/ToolbarCallbacks/file/linkMoveImpact.mjs';

const FILE_ITEM_SOUND_URLS = [
  "/soundEffects/Splish.mp3",
  "/soundEffects/Splish.wav",
  "/soundEffects/Tic.mp3",
  "/soundEffects/Tic.wav"
];
const CLIPBOARD_SHORTCUTS = {
  c: "copyFile",
  v: "pasteFile",
  x: "cutFile"
};
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
  icon.style.border = "1px solid rgba(0, 0, 0, 0.2)";
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

  const cacheKey = normalizePath(entry.path || entry.name || "");
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
      // Ignore network errors and try the next candidate.
    }
  }

  directoryImageCache.set(cacheKey, "");
  return "";
}
let fileItemHoverAudio = null;
let fileItemHoverAudioIndex = 0;
let lastFileItemHoverSoundAt = 0;
let fileItemHoverSoundUnlocked = false;

function getFileItemHoverAudio() {
  if (fileItemHoverAudio) return fileItemHoverAudio;
  const audio = new Audio(FILE_ITEM_SOUND_URLS[fileItemHoverAudioIndex]);
  audio.preload = "auto";
  audio.volume = 0.45;
  audio.addEventListener("error", () => {
    if (fileItemHoverAudioIndex < FILE_ITEM_SOUND_URLS.length - 1) {
      fileItemHoverAudioIndex += 1;
      fileItemHoverAudio = null;
    }
  });
  fileItemHoverAudio = audio;
  return audio;
}

async function unlockFileItemHoverSound() {
  if (fileItemHoverSoundUnlocked) return;
  const audio = getFileItemHoverAudio();
  const previousVolume = audio.volume;
  audio.volume = 0;
  try {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      await playPromise;
    }
    audio.pause();
    audio.currentTime = 0;
    fileItemHoverSoundUnlocked = true;
  } catch {
    // Ignore; we will retry on subsequent user gestures.
  } finally {
    audio.volume = previousVolume;
  }
}

if (!window.__nvFileItemSoundUnlockBound) {
  const unlockOnce = () => {
    unlockFileItemHoverSound();
  };
  window.addEventListener("pointerdown", unlockOnce, { passive: true });
  window.addEventListener("keydown", unlockOnce, { passive: true });
  window.__nvFileItemSoundUnlockBound = true;
}

function playFileItemHoverSound() {
  const now = Date.now();
  if (now - lastFileItemHoverSoundAt < 40) return;
  lastFileItemHoverSoundAt = now;
  try {
    const audio = getFileItemHoverAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // If blocked or failed, retry after first interaction unlock.
        fileItemHoverSoundUnlocked = false;
      });
    }
  } catch {
    // Ignore unavailable audio device/permission errors.
  }
}

function applyFileItemVisualState(link, state = "base") {
  if (!link) return;
  const base = {
    backgroundColor: "#ffffff",
    borderColor: "#c9d1dc",
    color: "#1f2937"
  };
  const hover = {
    backgroundColor: "#2f6fe5",
    borderColor: "#2f6fe5",
    color: "#ffffff"
  };
  const selected = {
    backgroundColor: "#2f6fe5",
    borderColor: "#2f6fe5",
    color: "#ffffff"
  };
  const palette = state === "selected" ? selected : state === "hover" ? hover : base;
  link.style.backgroundColor = palette.backgroundColor;
  link.style.borderColor = palette.borderColor;
  link.style.color = palette.color;
}

function markSelectedFileItem(selectedLink) {
  const allItems = document.querySelectorAll("#file-list a.file, #file-list a.folder");
  allItems.forEach((item) => {
    const isSelected = item === selectedLink;
    item.classList.toggle("selected", isSelected);
    applyFileItemVisualState(item, isSelected ? "selected" : "base");
  });
}



export function OpenDirectoryOrFileInfo(listElem,link, li)
{
  console.log("Opening "+ listElem + " at "+ link + " and "+ li);
      // Click: open directory or file info
    link.addEventListener("dblclick", async e => {
      e.preventDefault();
      if (f.isDirectory) {
        const newPath = `${currentPath}/${f.name}`.replace(/\/+/g, "/");
        await fetchDirectoryContents(newPath, displayFiles, document.getElementById("error"), document.getElementById("loading"));
      } else {
        try {
          const mod = await import("/panels/InfoPanel.mjs");
          mod.updateInfoPanel(f.name);
        } catch (err) {
          console.error("Failed to load InfoPanel module:", err);
        }
      }
    });

    li.appendChild(link);
    listElem.appendChild(li);
}

// ------------------------------
// Fetch directory contents
// ------------------------------
export async function fetchDirectoryContents(path, callback, errorElem, loadingElem) {
  try {
    if (loadingElem) loadingElem.style.display = "block";

    const cleanPath = path?.replace(/^\/+/, '') ?? '';
    const response = await fetch(`/api/files?path=${encodeURIComponent(cleanPath)}`);
    if (!response.ok) throw new Error(`Failed to fetch directory: ${path}`);

    const data = await response.json();
    console.log("Fetched directory contents:", data);

    if (typeof callback === "function") callback(data, cleanPath);

    window.currentDirectoryPath = cleanPath;
  } catch (err) {
    console.error(err);
    if (errorElem) errorElem.textContent = err.message;
  } finally {
    if (loadingElem) loadingElem.style.display = "none";
  }
}
window.fetchDirectoryContents = fetchDirectoryContents;

// ------------------------------
// Breadcrumbs
// ------------------------------
function renderBreadcrumbs(currentPath) {
  const pathElem = document.getElementById("fm-path");
  pathElem.innerHTML = "";

  const segments = currentPath.split("/").filter(Boolean);

  const rootLink = document.createElement("a");
  rootLink.href = "#";
  rootLink.textContent = "Notebook";
  rootLink.addEventListener("click", () =>
    fetchDirectoryContents("", displayFiles, document.getElementById("error"), document.getElementById("loading"))
  );
  pathElem.appendChild(rootLink);

  let cumulativePath = "";
  for (const seg of segments) {
    pathElem.appendChild(document.createTextNode(" / "));
    cumulativePath += "/" + seg;
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = seg;
    link.addEventListener("click", () =>
      fetchDirectoryContents(cumulativePath, displayFiles, document.getElementById("error"), document.getElementById("loading"))
    );
    pathElem.appendChild(link);
  }
}

// ------------------------------
// Display files in panel
// ------------------------------
export function displayFiles(files, currentPath) {
  const listElem = document.getElementById("file-list");
  if (!Array.isArray(files)) {
    listElem.innerHTML = "<li>Invalid data received.</li>";
    return;
  }

  listElem.innerHTML = "";
  const sortedFiles = [...files].sort(naturalCompareEntries);
  Object.assign(listElem.style, {
    listStyle: "none",
    margin: "0",
    padding: "0",
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  });

  // ".." entry — only if not at root
  if (currentPath !== "") {
    const li = document.createElement("li");
    li.style.margin = "0";
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = "..";
    link.classList.add("folder");
    Object.assign(link.style, {
      display: "flex",
      alignItems: "center",
      width: "100%",
      minHeight: "24px",
      padding: "2px 8px",
      border: "1px solid #c9d1dc",
      borderRadius: "0",
      textDecoration: "none",
      fontSize: "12px",
      lineHeight: "1.2",
      boxSizing: "border-box",
      transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease"
    });
    applyFileItemVisualState(link, "base");
    link.addEventListener("mouseenter", () => {
      if (!link.classList.contains("selected")) applyFileItemVisualState(link, "hover");
      playFileItemHoverSound();
    });
    link.addEventListener("mouseleave", () => {
      applyFileItemVisualState(link, link.classList.contains("selected") ? "selected" : "base");
    });
    link.addEventListener("click", () => {
      const segments = currentPath.split("/").filter(Boolean);
      segments.pop();
      const newPath = segments.join("/");
      window.refreshFileManager(newPath);
    });
    // Enable drag-drop onto parent ("..") to move items up one level.
    link.addEventListener("dragenter", e => {
      if (!hasDragPayload(e)) return;
      e.preventDefault();
      link.style.backgroundColor = "#e8f4ff";
      link.style.outline = "1px dashed #4b7fd1";
    });
    link.addEventListener("dragover", e => {
      if (!hasDragPayload(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    link.addEventListener("dragleave", e => {
      if (!link.contains(e.relatedTarget)) {
        applyFileItemVisualState(link, link.classList.contains("selected") ? "selected" : "base");
        link.style.outline = "";
      }
    });
    link.addEventListener("drop", async e => {
      e.preventDefault();
      applyFileItemVisualState(link, link.classList.contains("selected") ? "selected" : "base");
      link.style.outline = "";

      const dragData = readDragPayload(e);
      if (!dragData?.path) return;

      const sourcePath = normalizePath(dragData.path);
      const segments = currentPath.split("/").filter(Boolean);
      segments.pop();
      const destinationDir = segments.join("/");
      if (isSameParent(sourcePath, destinationDir)) return;
      if (dragData.isDirectory && isSubPath(destinationDir, sourcePath)) {
        console.warn("Cannot move a directory into itself or one of its descendants.");
        return;
      }

      const destinationPath = destinationDir ? `${destinationDir}/${basename(sourcePath)}` : basename(sourcePath);

      try {
        await moveFileOrDirectoryAPI(sourcePath, destinationDir);
        if (!dragData.isDirectory) {
          await maybePromptLinkMoveImpact({ oldPath: sourcePath, newPath: destinationPath });
        }
        await window.refreshFileManager(currentPath);
      } catch (err) {
        console.error("Failed to move file or directory via parent drop:", err);
      }
    });
    li.appendChild(link);
    listElem.appendChild(li);
  }

  renderBreadcrumbs(currentPath);

  sortedFiles.forEach(f => {
    const li = document.createElement("li");
    li.style.margin = "0";
    const link = document.createElement("a");
    link.href = "#";
    link.classList.add(f.isDirectory ? "folder" : "file");
    link.style.display = "flex";
    link.style.alignItems = "center";
    link.style.gap = "8px";
    link.style.width = "100%";
    link.style.minHeight = "24px";
    link.style.padding = "2px 8px";
    link.style.border = "1px solid #c9d1dc";
    link.style.borderRadius = "0";
    link.style.textDecoration = "none";
    link.style.fontSize = "12px";
    link.style.lineHeight = "1.2";
    link.style.boxSizing = "border-box";
    link.style.transition = "background-color 120ms ease, border-color 120ms ease, color 120ms ease";
    applyFileItemVisualState(link, "base");
    link.addEventListener("mouseenter", () => {
      if (!link.classList.contains("selected")) applyFileItemVisualState(link, "hover");
      playFileItemHoverSound();
    });
    link.addEventListener("mouseleave", () => {
      applyFileItemVisualState(link, link.classList.contains("selected") ? "selected" : "base");
    });

    const icon = document.createElement("span");
    icon.style.display = "inline-flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.width = "20px";
    icon.style.height = "20px";
    icon.style.flex = "0 0 20px";
    icon.style.borderRadius = "3px";

    const directoryImageUrl = f.isDirectory ? resolveDirectoryImageUrl(f) : "";

    if (directoryImageUrl) {
      applyDirectoryImageIcon(icon, directoryImageUrl);
    } else {
      applyEmojiIcon(icon, f.isDirectory ? "📁" : "🖹");
      if (f.isDirectory) {
        // Fallback probe in case the API omitted directory image metadata.
        findDirectoryImageUrl(f).then((url) => {
          if (url) applyDirectoryImageIcon(icon, url);
        });
      }
    }

    const label = document.createElement("span");
    label.textContent = f.name;
    label.style.minWidth = "0";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";
    label.style.whiteSpace = "nowrap";

    link.appendChild(icon);
    link.appendChild(label);

    // Save full path on element for selection
    link.dataset.fullPath = (currentPath ? `${currentPath}/${f.name}` : f.name).replace(/\/+/g, "/");
    link.dataset.isDirectory = String(Boolean(f.isDirectory));

    // Drag & drop
    link.draggable = true;
    link.addEventListener("dragstart", e => {
      const payload = {
        path: link.dataset.fullPath,
        isDirectory: link.dataset.isDirectory === "true",
      };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/json", JSON.stringify(payload));
      e.dataTransfer.setData("text/plain", payload.path);
      link.style.opacity = "0.6";
    });
    link.addEventListener("dragend", () => {
      link.style.opacity = "";
      clearDropHighlights();
    });

    if (f.isDirectory) {
      link.addEventListener("dragenter", e => {
        if (!hasDragPayload(e)) return;
        e.preventDefault();
        link.style.backgroundColor = "#e8f4ff";
        link.style.outline = "1px dashed #4b7fd1";
      });
      link.addEventListener("dragover", e => {
        if (!hasDragPayload(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      link.addEventListener("dragleave", e => {
        if (!link.contains(e.relatedTarget)) {
          applyFileItemVisualState(link, link.classList.contains("selected") ? "selected" : "base");
          link.style.outline = "";
        }
      });
      link.addEventListener("drop", async e => {
        e.preventDefault();
        applyFileItemVisualState(link, link.classList.contains("selected") ? "selected" : "base");
        link.style.outline = "";

        const dragData = readDragPayload(e);
        if (!dragData?.path) return;

        const sourcePath = normalizePath(dragData.path);
        const destinationDir = normalizePath(link.dataset.fullPath);

        if (sourcePath === destinationDir) return;
        if (isSameParent(sourcePath, destinationDir)) return;

        if (dragData.isDirectory && isSubPath(destinationDir, sourcePath)) {
          console.warn("Cannot move a directory into itself or one of its descendants.");
          return;
        }

        try {
          await moveFileOrDirectoryAPI(sourcePath, destinationDir);
          if (!dragData.isDirectory) {
            const destinationPath = destinationDir ? `${destinationDir}/${basename(sourcePath)}` : basename(sourcePath);
            await maybePromptLinkMoveImpact({ oldPath: sourcePath, newPath: destinationPath });
          }
          await window.refreshFileManager(currentPath);
        } catch (err) {
          console.error("Failed to move file or directory:", err);
        }
      });
    }
    
    // Click: open directory or file info
console.log("Opening "+ listElem + " at "+ link + " and "+ li);
      // Click: open directory or file info
    link.addEventListener("dblclick", async e => {
      e.preventDefault();
      if (f.isDirectory) {
        const newPath = `${currentPath}/${f.name}`.replace(/\/+/g, "/");
        await fetchDirectoryContents(newPath, displayFiles, document.getElementById("error"), document.getElementById("loading"));
      } else {
        try {
          const mod = await import("/panels/InfoPanel.mjs");
          mod.updateInfoPanel(f.name);
        } catch (err) {
          console.error("Failed to load InfoPanel module:", err);
        }
      }
    });

    li.appendChild(link);
    listElem.appendChild(li);
  });

  // ✅ Attach file selection logic
  attachFileClickHandlers();
}

// ------------------------------
// Selection logic
// ------------------------------

export function attachFileClickHandlers() {
  const fileItems = document.querySelectorAll("#file-list a.file, #file-list a.folder");
  fileItems.forEach(item => {
    item.addEventListener("click", e => {
      e.preventDefault();

      // Set global selected file path
      window.selectedFilePath = item.dataset.fullPath;
      // FileView installs a selectedFilePath proxy that syncs NodevisionState + toolbar.
      // If that proxy isn't installed (e.g., FileView panel not loaded yet), do it here.
      if (!window._selectedFileProxyInstalled) {
        window.NodevisionState = window.NodevisionState || {};
        window.NodevisionState.selectedFile = window.selectedFilePath || null;
        updateToolbarState({ selectedFile: window.NodevisionState.selectedFile });
      }
      console.log("Selected file:", window.selectedFilePath);

      // Visually mark selection
      markSelectedFileItem(item);
    });
  });
}

// ------------------------------
// Move file/directory
// ------------------------------
export async function moveFileOrDirectory(src, destDir) {
  // Kept for backward compatibility; delegate to shared FileManager API
  return moveFileOrDirectoryAPI(src, destDir);
}

function normalizePath(value = "") {
  return String(value).replace(/^\/+/, "").replace(/\/+/g, "/");
}

function basename(pathValue = "") {
  const parts = normalizePath(pathValue).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function dirnameSafe(p = "") {
  const parts = normalizePath(p).split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function isSameParent(sourcePath, destinationDirPath) {
  return dirnameSafe(sourcePath) === normalizePath(destinationDirPath);
}

function isSubPath(candidate, root) {
  const c = normalizePath(candidate);
  const r = normalizePath(root);
  return c === r || c.startsWith(`${r}/`);
}

function hasDragPayload(evt) {
  const types = evt?.dataTransfer?.types;
  if (!types) return false;
  const asArray = Array.from(types);
  return asArray.includes("application/json") || asArray.includes("text/plain");
}

function readDragPayload(evt) {
  const transfer = evt?.dataTransfer;
  if (!transfer) return null;
  const raw = transfer.getData("application/json");
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // Fall through to plain text.
    }
  }
  const plain = transfer.getData("text/plain");
  return plain ? { path: plain, isDirectory: false } : null;
}

function clearDropHighlights() {
  document.querySelectorAll("#file-list a.folder").forEach(el => {
    el.style.backgroundColor = "";
    el.style.outline = "";
  });
}

// ------------------------------
// Initialize panel
// ------------------------------
export function initFileView(initialPath = '') {
  const loadingElem = document.getElementById("loading");
  const errorElem = document.getElementById("error");

  window.currentDirectoryPath = initialPath ?? "";
  fetchDirectoryContents(window.currentDirectoryPath, displayFiles, errorElem, loadingElem);
}

// ------------------------------
// Create new file
// ------------------------------
export async function createNewFile(fileName, currentPath = '') {
  if (!fileName) throw new Error("File name is required");

  const cleanPath = currentPath.replace(/^\/+/, '');
  const fullPath = cleanPath ? `${cleanPath}/${fileName}` : fileName;

  const res = await fetch("/api/files/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: fullPath }),
  });

  if (!res.ok) throw new Error(`Failed to create file: ${fileName}`);
  const result = await res.json();
  console.log("Created new file:", result);

  await window.refreshFileManager(cleanPath);
  return result;
}


// ------------------------------
// Global refresh helper
// ------------------------------
window.refreshFileManager = async function (path = '') {
  try {
    const effectivePath = path ?? window.currentDirectoryPath ?? '';
    const loadingElem = document.getElementById("loading");
    const errorElem = document.getElementById("error");

    console.log("Refreshing File Manager view for:", effectivePath);
    await fetchDirectoryContents(effectivePath, displayFiles, errorElem, loadingElem);
  } catch (err) {
    console.error("Failed to refresh File Manager:", err);
  }
};

// ------------------------------
// Toolbar action dispatcher
// ------------------------------
function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function fileActionModuleCandidates(actionKey = "") {
  const key = String(actionKey || "").trim();
  if (!key) return [];

  const capitalized = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  const legacyAliases = {
    renameFile: ["RenameFile"],
    copyFile: ["CopyFIle", "CopyFile"],
    cutFile: ["CutFile"],
    pasteFile: ["PasteFile"]
  };
  const aliases = legacyAliases[key] || [];
  const names = uniqueValues([key, capitalized, ...aliases]);
  return names.map((name) => `/ToolbarCallbacks/file/${name}.mjs`);
}

export async function handleFileManagerAction(actionKey) {
  console.log(`FileManagerCore: handling toolbar action "${actionKey}"`);

  const modulePaths = fileActionModuleCandidates(actionKey);
  const importErrors = [];

  for (const modulePath of modulePaths) {
    try {
      const callbackModule = await import(modulePath);
      if (typeof callbackModule.default === "function") {
        await callbackModule.default();
        return;
      }
    } catch (err) {
      importErrors.push(err);
    }
  }

  const callbackFromWindow =
    window.fileCallbacks && typeof window.fileCallbacks[actionKey] === "function"
      ? window.fileCallbacks[actionKey]
      : null;

  if (callbackFromWindow) {
    try {
      await callbackFromWindow();
      return;
    } catch (err) {
      console.error(`Error executing toolbar action ${actionKey}:`, err);
      alert(`Error executing toolbar action "${actionKey}": ${err.message}`);
      return;
    }
  }

  const rootCause = importErrors[0];
  const rootCauseMessage = rootCause?.message || "No matching callback module found.";
  console.error(`Error executing toolbar action ${actionKey}:`, rootCause || new Error(rootCauseMessage));
  alert(`Error executing toolbar action "${actionKey}": ${rootCauseMessage}`);
}
window.handleFileManagerAction = handleFileManagerAction;

// ------------------------------
// Keyboard shortcuts (Copy / Paste / Cut)
// ------------------------------
function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest?.('[role="textbox"]'));
}

function shouldHandleFileManagerShortcut() {
  const state = window.NodevisionState || {};
  const handlerMatches = state.activeActionHandler === window.handleFileManagerAction;
  const panelMatches = state.activePanelType === "FileManager";
  if (panelMatches) return true;
  if (typeof state.activePanelType === "string" && state.activePanelType.trim()) {
    return false;
  }
  return handlerMatches;
}

function registerFileManagerClipboardShortcuts() {
  if (window.__nvFileManagerClipboardShortcutsBound) return;

  const listener = async (e) => {
    if (e.altKey || !(e.ctrlKey || e.metaKey) || e.repeat) return;
    const actionKey = CLIPBOARD_SHORTCUTS[e.key?.toLowerCase?.()] || null;
    if (!actionKey) return;
    if (!shouldHandleFileManagerShortcut()) return;
    if (isEditableTarget(e.target)) return;
    if (typeof window.handleFileManagerAction !== "function") return;

    e.preventDefault();
    try {
      await window.handleFileManagerAction(actionKey);
    } catch (err) {
      console.error("FileManager clipboard shortcut failed:", err);
    }
  };

  document.addEventListener("keydown", listener);
  window.__nvFileManagerClipboardShortcutsBound = true;
}

registerFileManagerClipboardShortcuts();

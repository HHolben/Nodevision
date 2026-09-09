// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerRenderer.mjs
// This file defines browser-side File Manager Renderer logic for the Nodevision UI. It renders interface components and handles user interactions.
import { attachSelectionHandlers } from "./FileManagerSelection.mjs";
import { attachDragDrop } from "./FileManagerDragDrop.mjs";
import { findDirectoryImageUrl, resolveDirectoryImageUrl } from "/PanelInstances/InfoPanels/FileManagerDirectoryImages.mjs";

const FILE_MANAGER_ICON_SIZE = "20px";
const FILE_MANAGER_ICON_BORDER = "1px solid transparent";

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
  icon.style.border = FILE_MANAGER_ICON_BORDER;
  icon.textContent = emoji;
  icon.style.fontSize = "14px";
  icon.style.lineHeight = "1";
}

function normalizeFileManagerPath(value = "") {
  let text = String(value || "").split(String.fromCharCode(92)).join("/").trim();
  while (text.startsWith("/")) text = text.slice(1);
  while (text.includes("//")) text = text.replaceAll("//", "/");
  return text;
}

function parentFileManagerPath(path = "") {
  const parts = normalizeFileManagerPath(path).split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function styleScopedFileList(list) {
  if (!list) return;
  Object.assign(list.style, {
    listStyle: "none",
    margin: "0",
    padding: "0 0 4px",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "4px",
    width: "100%",
    boxSizing: "border-box",
    overflowAnchor: "none"
  });
}

function appendParentDirectoryEntry(state, list) {
  const currentPath = normalizeFileManagerPath(state.currentPath || "");
  if (!currentPath) return;

  const li = document.createElement("li");
  const link = document.createElement("a");
  link.href = "#";
  link.classList.add("folder");
  link.textContent = "..";
  link.dataset.fullPath = parentFileManagerPath(currentPath);
  link.dataset.isDirectory = "true";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    state.refresh?.(link.dataset.fullPath || "");
  });
  li.appendChild(link);
  list.appendChild(li);
}

function activateFileManagerEntry(state, link, entry) {
  const path = normalizeFileManagerPath(link.dataset.fullPath || "");
  const isDirectory = link.dataset.isDirectory === "true";
  if (isDirectory) {
    state.refresh?.(path);
    return;
  }
  state.onEntryActivate?.({ path, isDirectory, entry, element: link });
}

export function renderFiles(state, files) {
  const list = state.panelElem.querySelector("#file-list");
  list.innerHTML = "";
  styleScopedFileList(list);

  const sortedFiles = [...files].sort(naturalCompareEntries);
  appendParentDirectoryEntry(state, list);

  sortedFiles.forEach(file => {
    const li = document.createElement("li");
    const link = document.createElement("a");

    link.href = "#";
    link.classList.add(file.isDirectory ? "folder" : "file");
    link.dataset.isDirectory = String(Boolean(file.isDirectory));
    link.dataset.fullPath = normalizeFileManagerPath(
      file.path || (state.currentPath ? `${state.currentPath}/${file.name}` : file.name)
    );

    const icon = document.createElement("span");
    icon.style.display = "inline-flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.width = FILE_MANAGER_ICON_SIZE;
    icon.style.height = FILE_MANAGER_ICON_SIZE;
    icon.style.flex = "0 0 " + FILE_MANAGER_ICON_SIZE;
    icon.style.marginRight = "6px";
    icon.style.border = FILE_MANAGER_ICON_BORDER;
    icon.style.boxSizing = "border-box";
    icon.style.overflow = "hidden";

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
    Object.assign(label.style, {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    });

    link.appendChild(icon);
    link.appendChild(label);
    link.href = "#";

    li.appendChild(link);
    list.appendChild(li);

    link.addEventListener("dblclick", (event) => {
      event.preventDefault();
      activateFileManagerEntry(state, link, file);
    });

    attachSelectionHandlers(state, link);
    if (state.enableDragDrop !== false) {
      attachDragDrop(state, link, file);
    }
  });
}

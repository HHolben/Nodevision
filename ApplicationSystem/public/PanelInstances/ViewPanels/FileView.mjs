// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileView.mjs
// This file defines browser-side File View logic for the Nodevision UI. It renders interface components and handles user interactions.

import { guardFileSwitch } from "/EditorSwitchGuard.mjs";
import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";
import { normalizeNotebookRelativePath } from "/utils/notebookPath.mjs";
import {
  applyLinkRecordEdit,
  csvToList,
  fetchNotebookText,
  listToCsv,
  normalizeSymbols,
  saveNotebookText,
  scanFileForLinkRecords,
  selectedGraphLink,
  setSelectedGraphLink,
  summarizeLinkRecord,
} from "/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { setStatus } from "/StatusBar.mjs";

let lastRenderedPath = null;
let viewDivRef = null;


let moduleMapCache = null;

const navigationState = getNodevisionNavigationState();
let pendingFileViewAnchor = null;
let pendingFileViewAnchorTimer = null;

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function decodeUriSafely(value = "") {
  try {
    return decodeURI(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function decodeHashSafely(value = "") {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function normalizeResolvedNotebookPath(value = "") {
  const clean = normalizeNotebookRelativePath(value || "");
  const parts = [];
  clean.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") {
      if (parts.length > 0) parts.pop();
      return;
    }
    parts.push(part);
  });
  return parts.join("/");
}

function dirnamePath(pathValue = "") {
  const clean = normalizeResolvedNotebookPath(pathValue);
  if (!clean.includes("/")) return "";
  return clean.slice(0, clean.lastIndexOf("/"));
}

function sameNotebookPath(a, b) {
  return normalizeResolvedNotebookPath(a).toLowerCase() === normalizeResolvedNotebookPath(b).toLowerCase();
}

function splitHrefParts(rawHref = "") {
  const text = String(rawHref || "").trim();
  const hashIndex = text.indexOf("#");
  const beforeHash = hashIndex >= 0 ? text.slice(0, hashIndex) : text;
  const hash = hashIndex >= 0 ? decodeHashSafely(text.slice(hashIndex + 1)) : "";
  const queryIndex = beforeHash.indexOf("?");
  const path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  return { path, hash };
}

function isUnsupportedLinkProtocol(rawHref = "") {
  const text = String(rawHref || "").trim().toLowerCase();
  return (
    text.startsWith("//") ||
    text.startsWith("mailto:") ||
    text.startsWith("tel:") ||
    text.startsWith("javascript:") ||
    text.startsWith("data:") ||
    text.startsWith("blob:")
  );
}

function stripNotebookLinkRoot(pathPart = "") {
  let candidate = decodeUriSafely(pathPart).replace(/\\/g, "/").trim();
  candidate = candidate.replace(/^\/+/, "");
  const lower = candidate.toLowerCase();
  if (lower.startsWith("notebook/")) {
    return candidate.slice("Notebook/".length);
  }
  if (lower.startsWith("php/")) {
    return candidate.slice("php/".length);
  }
  return candidate;
}

function resolveNotebookDocumentLink(rawHref, sourcePath) {
  const href = String(rawHref || "").trim();
  if (!href || isUnsupportedLinkProtocol(href)) return null;

  const currentPath = normalizeResolvedNotebookPath(sourcePath || getActiveFilePath());
  const sourceDir = dirnamePath(currentPath);

  if (href.startsWith("#")) {
    return currentPath ? {
      path: currentPath,
      hash: decodeHashSafely(href.slice(1)),
      isDirectory: false,
      isSameDocumentAnchor: true,
    } : null;
  }

  let pathPart = "";
  let hash = "";
  let isRootRelative = false;
  let explicitlyDirectory = false;

  if (/^https?:\/\//i.test(href)) {
    let parsed = null;
    try {
      parsed = new URL(href);
    } catch {
      return null;
    }
    if (parsed.origin !== window.location.origin) return null;

    const lowerPath = parsed.pathname.toLowerCase();
    if (!lowerPath.startsWith("/notebook/") && !lowerPath.startsWith("/php/") && !parsed.pathname.includes(".") && !parsed.pathname.endsWith("/")) {
      return null;
    }

    pathPart = parsed.pathname;
    hash = parsed.hash ? decodeHashSafely(parsed.hash.slice(1)) : "";
    isRootRelative = true;
    explicitlyDirectory = pathPart.endsWith("/");
  } else {
    const parts = splitHrefParts(href);
    pathPart = parts.path;
    hash = parts.hash;
    isRootRelative = pathPart.startsWith("/") || pathPart.toLowerCase().startsWith("notebook/") || pathPart.toLowerCase().startsWith("php/");
    explicitlyDirectory = pathPart.endsWith("/");
  }

  if (!pathPart) {
    return currentPath && hash ? {
      path: currentPath,
      hash,
      isDirectory: false,
      isSameDocumentAnchor: true,
    } : null;
  }

  let candidate = decodeUriSafely(pathPart).replace(/\\/g, "/");
  if (candidate.startsWith("/")) {
    const lowerCandidate = candidate.toLowerCase();
    if (lowerCandidate.startsWith("/notebook/") || lowerCandidate.startsWith("/php/")) {
      candidate = stripNotebookLinkRoot(candidate);
    } else {
      const rootCandidate = candidate.replace(/^\/+/, "");
      if (!rootCandidate || (!rootCandidate.includes(".") && !candidate.endsWith("/"))) {
        return null;
      }
      candidate = rootCandidate;
    }
  } else if (isRootRelative) {
    candidate = stripNotebookLinkRoot(candidate);
  } else {
    candidate = sourceDir ? sourceDir + "/" + candidate : candidate;
  }

  const targetPath = normalizeResolvedNotebookPath(candidate).replace(/\/+$/, "");
  if (!targetPath) return null;

  return {
    path: targetPath,
    hash,
    isDirectory: explicitlyDirectory || !targetPath.includes("."),
    isSameDocumentAnchor: sameNotebookPath(targetPath, currentPath) && Boolean(hash),
  };
}

function getAnchorFromClick(event) {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  for (const node of path) {
    if (!node || node.nodeType !== 1) continue;
    if (typeof node.matches === "function" && node.matches("a[href]")) return node;
    if (typeof node.closest === "function") {
      const anchor = node.closest("a[href]");
      if (anchor) return anchor;
    }
  }
  return event.target?.closest?.("a[href]") || null;
}

function shouldHandleFileViewLinkClick(event) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function isNavigatorPanelOpen(panelType) {
  if (panelType === "FileManager") {
    return Boolean(document.getElementById("file-list") && typeof window.revealPathInFileManager === "function");
  }
  if (panelType === "GraphManager") {
    return Boolean(document.getElementById("cy") && typeof window.revealPathInGraphManager === "function");
  }
  return false;
}

function getLinkNavigatorCandidates() {
  const selectionSource = navigationState.getLastFileSelectionPanelType?.();
  if (selectionSource) return [selectionSource];

  const activeInfoPanel = window.NodevisionState?.activePanelType;
  return uniqueValues([
    navigationState.getLastInfoPanelType?.(),
    activeInfoPanel === "FileManager" || activeInfoPanel === "GraphManager" ? activeInfoPanel : null,
    "FileManager",
    "GraphManager",
  ]);
}

async function revealLinkedPathInOriginNavigator(path, { isDirectory = false } = {}) {
  const cleanPath = normalizeResolvedNotebookPath(path);
  if (!cleanPath) return false;

  for (const panelType of getLinkNavigatorCandidates()) {
    if (!isNavigatorPanelOpen(panelType)) continue;
    try {
      if (panelType === "FileManager") {
        const opened = await window.revealPathInFileManager(cleanPath, { isDirectory, selectFile: false });
        if (opened) {
          navigationState.setLastFileSelectionPanelType?.("FileManager");
          return true;
        }
      }
      if (panelType === "GraphManager") {
        const opened = await window.revealPathInGraphManager(cleanPath, { isDirectory, selectFile: false });
        if (opened) {
          navigationState.setLastFileSelectionPanelType?.("GraphManager");
          return true;
        }
      }
    } catch (err) {
      console.warn("[FileView] Failed to reveal linked path in " + panelType + ":", err);
    }
  }

  return false;
}

function setPendingFileViewAnchor(path, hash) {
  if (!hash) {
    pendingFileViewAnchor = null;
    if (pendingFileViewAnchorTimer) {
      window.clearTimeout(pendingFileViewAnchorTimer);
      pendingFileViewAnchorTimer = null;
    }
    return;
  }

  pendingFileViewAnchor = {
    path: normalizeResolvedNotebookPath(path),
    hash,
    attempts: 0,
  };
}

function findNamedAnchorInRoot(root, hash) {
  if (!root || typeof root.querySelectorAll !== "function") return null;
  for (const candidate of root.querySelectorAll("[name]")) {
    if (candidate.getAttribute("name") === hash) return candidate;
  }
  return null;
}

function findAnchorTargetInRoot(root, hash) {
  if (!root || !hash) return null;
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const byId = doc?.getElementById?.(hash);
  if (byId && (root.nodeType === 9 || root.contains(byId))) return byId;
  return findNamedAnchorInRoot(root, hash);
}

function scrollElementIntoView(target) {
  if (!target) return false;
  try {
    target.scrollIntoView({ block: "start", inline: "nearest" });
  } catch {
    target.scrollIntoView?.();
  }
  return true;
}

function scrollFileViewToAnchor(hash) {
  const cleanHash = decodeHashSafely(hash).trim();
  if (!cleanHash) return false;

  const viewPanel = getViewPanelElement();
  if (!viewPanel) return false;

  const target = findAnchorTargetInRoot(viewPanel, cleanHash);
  if (scrollElementIntoView(target)) return true;

  const iframes = viewPanel.querySelectorAll("iframe");
  for (const iframe of iframes) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      const iframeTarget = findAnchorTargetInRoot(doc, cleanHash);
      if (scrollElementIntoView(iframeTarget)) return true;
    } catch {
      // Cross-origin iframe documents cannot be inspected.
    }
  }

  return false;
}

function tryScrollToPendingFileViewAnchor(renderedPath = getActiveFilePath()) {
  if (!pendingFileViewAnchor) return;
  if (!sameNotebookPath(renderedPath, pendingFileViewAnchor.path)) return;

  if (scrollFileViewToAnchor(pendingFileViewAnchor.hash)) {
    pendingFileViewAnchor = null;
    if (pendingFileViewAnchorTimer) {
      window.clearTimeout(pendingFileViewAnchorTimer);
      pendingFileViewAnchorTimer = null;
    }
    return;
  }

  pendingFileViewAnchor.attempts += 1;
  if (pendingFileViewAnchor.attempts >= 10) {
    pendingFileViewAnchor = null;
    return;
  }

  if (!pendingFileViewAnchorTimer) {
    pendingFileViewAnchorTimer = window.setTimeout(() => {
      pendingFileViewAnchorTimer = null;
      tryScrollToPendingFileViewAnchor(renderedPath);
    }, 80);
  }
}

function selectLinkedPathInFileView(targetPath, { hash = "", isDirectory = false } = {}) {
  const cleanPath = normalizeResolvedNotebookPath(targetPath);
  if (!cleanPath) return;

  const applySelection = () => {
    setPendingFileViewAnchor(cleanPath, hash);
    window.__nvFileSwitchGuardBypass = true;
    try {
      window.selectedFilePath = cleanPath;
    } finally {
      window.__nvFileSwitchGuardBypass = false;
    }
    revealLinkedPathInOriginNavigator(cleanPath, { isDirectory }).catch((err) => {
      console.warn("[FileView] Failed to reveal linked path:", err);
    });
  };

  if (typeof guardFileSwitch === "function") {
    guardFileSwitch(cleanPath, applySelection);
  } else if (typeof window.__nvGuardFileSwitch === "function") {
    window.__nvGuardFileSwitch(cleanPath, applySelection);
  } else {
    applySelection();
  }
}

function navigateFileViewLink(resolvedLink) {
  if (!resolvedLink?.path) return;

  if (resolvedLink.isSameDocumentAnchor) {
    scrollFileViewToAnchor(resolvedLink.hash);
    revealLinkedPathInOriginNavigator(resolvedLink.path, { isDirectory: resolvedLink.isDirectory }).catch((err) => {
      console.warn("[FileView] Failed to reveal same-document link:", err);
    });
    return;
  }

  selectLinkedPathInFileView(resolvedLink.path, {
    hash: resolvedLink.hash,
    isDirectory: resolvedLink.isDirectory,
  });
}

function handleFileViewLinkClick(event) {
  if (!shouldHandleFileViewLinkClick(event)) return;

  const anchor = getAnchorFromClick(event);
  if (!anchor || anchor.hasAttribute("download")) return;

  const rawHref = anchor.getAttribute("href") || "";
  const resolvedLink = resolveNotebookDocumentLink(rawHref, getActiveFilePath());
  if (!resolvedLink) return;

  event.preventDefault();
  navigateFileViewLink(resolvedLink);
}

function installFileViewLinkNavigation(viewDiv) {
  if (!viewDiv || viewDiv.__nvFileViewLinkNavigationAttached) return;
  viewDiv.__nvFileViewLinkNavigationAttached = true;
  viewDiv.addEventListener("click", handleFileViewLinkClick, { capture: true });
}


const LINK_TEXT_PREVIEW_EXTS = new Set([
  "txt", "md", "markdown", "html", "htm", "xhtml", "php", "css", "js", "mjs", "cjs", "json", "xml", "svg", "csv", "ts", "tsx", "jsx", "py", "java", "c", "cpp", "h", "hpp", "ino", "yml", "yaml", "toml", "ini", "log"
]);
const LINK_IMAGE_PREVIEW_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg"]);
const LINK_AUDIO_PREVIEW_EXTS = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac"]);
const LINK_VIDEO_PREVIEW_EXTS = new Set(["mp4", "webm", "ogv", "mov"]);
let currentLinkViewSelection = null;

function escapeLinkHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function pathExtension(pathValue = "") {
  const clean = normalizeResolvedNotebookPath(pathValue).toLowerCase();
  const last = clean.split("/").pop() || "";
  if (!last.includes(".")) return "";
  return last.split(".").pop() || "";
}

function notebookAssetUrl(pathValue = "") {
  const parts = normalizeResolvedNotebookPath(pathValue)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent);
  return "/Notebook/" + parts.join("/");
}

function linkTargetDisplay(record = {}) {
  return record.targetKind === "external" ? (record.targetRaw || record.targetPath || "") : (record.targetPath || record.targetRaw || "");
}

function canEditLinkRecord(record = {}) {
  return Boolean(record.editableTarget || record.editableText || record.editableMetadata);
}

function makeLinkViewButton(label, role = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nv-link-file-btn";
  button.textContent = label;
  if (role) button.dataset.role = role;
  return button;
}

function setLinkViewStatus(root, message, kind = "") {
  const status = root?.querySelector?.("[data-role=\"link-status\"]");
  if (!status) return;
  status.textContent = message || "";
  status.dataset.kind = kind;
}

function detailLine(label, value) {
  const row = document.createElement("div");
  row.className = "nv-link-file-detail-row";
  const labelEl = document.createElement("div");
  labelEl.className = "nv-link-file-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("div");
  valueEl.className = "nv-link-file-value";
  valueEl.textContent = value === undefined || value === null || value === "" ? "None" : String(value);
  row.append(labelEl, valueEl);
  return row;
}

function fieldNode({ id, label, value = "", disabled = false, placeholder = "" }) {
  const field = document.createElement("label");
  field.className = "nv-link-file-field";
  field.htmlFor = id;
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.id = id;
  input.value = value || "";
  input.placeholder = placeholder || "";
  input.disabled = Boolean(disabled);
  field.append(span, input);
  return field;
}

function occurrenceLabelForLink(record, index) {
  const type = record?.linkProperty || record?.linkKind || "link";
  const target = record?.targetRaw || record?.targetPath || "";
  return String(index + 1) + ". " + type + " - " + target;
}

function renderLinkOccurrenceSelector(shell, selection) {
  const occurrences = Array.isArray(selection?.occurrences) ? selection.occurrences : [];
  if (occurrences.length <= 1) return;

  const select = document.createElement("select");
  select.className = "nv-link-file-select";
  select.setAttribute("aria-label", "Link occurrence");
  occurrences.forEach((occurrence, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = occurrenceLabelForLink(occurrence, index);
    option.selected = index === selection.occurrenceIndex;
    select.appendChild(option);
  });
  select.addEventListener("change", () => {
    const index = Number(select.value) || 0;
    setSelectedGraphLink({
      ...selection,
      occurrenceIndex: index,
      record: occurrences[index] || occurrences[0] || null,
    });
  });
  shell.appendChild(select);
}

function renderLinkDescription(shell, selection) {
  const record = selection?.record || {};
  const section = document.createElement("section");
  section.className = "nv-link-file-section";
  const title = document.createElement("h3");
  title.textContent = "Link Attributes";
  section.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "nv-link-file-details";
  const rows = [
    ["Summary", summarizeLinkRecord(record)],
    ["Edge", selection?.edgeId || ""],
    ["Occurrence", String((Number(selection?.occurrenceIndex) || 0) + 1) + " of " + String(selection?.occurrenceCount || 1)],
    ["Record ID", record.id || ""],
    ["Record Index", record.recordIndex ?? ""],
    ["Source Format", record.sourceFormat || ""],
    ["Type", record.linkKind || ""],
    ["Property", record.linkProperty || ""],
    ["Scope", record.targetKind || ""],
    ["Source", record.sourcePath || ""],
    ["Resolved Target", linkTargetDisplay(record)],
    ["Raw Target", record.targetRaw || ""],
    ["Link Text", record.linkText || ""],
    ["Graph Text", record.displayText || ""],
    ["Tags", listToCsv(record.tags || [])],
    ["Symbols", normalizeSymbols(record.symbols || []).join(" ")],
    ["Editable Target", record.editableTarget ? "Yes" : "No"],
    ["Editable Text", record.editableText ? "Yes" : "No"],
    ["Editable Metadata", record.editableMetadata ? "Yes" : "No"],
  ];
  rows.forEach(([label, value]) => grid.appendChild(detailLine(label, value)));
  section.appendChild(grid);
  shell.appendChild(section);
}

function readLinkPatchFromForm(root) {
  return {
    targetRaw: root.querySelector("#nv-link-file-target")?.value || "",
    linkText: root.querySelector("#nv-link-file-text")?.value || "",
    tags: csvToList(root.querySelector("#nv-link-file-tags")?.value || ""),
    symbols: normalizeSymbols(root.querySelector("#nv-link-file-symbols")?.value || ""),
    displayText: root.querySelector("#nv-link-file-display")?.value || "",
  };
}

function nextLinkSelectionFromRecords(records, sourceRecord, selection) {
  const updatedRecord = records.find((item) => item.recordIndex === sourceRecord.recordIndex) || records[0] || null;
  if (!updatedRecord) return null;
  return {
    edgeId: selection?.edgeId || "",
    source: updatedRecord.sourcePath,
    target: updatedRecord.targetPath,
    occurrenceIndex: updatedRecord.recordIndex || 0,
    occurrenceCount: records.length,
    occurrences: records,
    record: updatedRecord,
  };
}

async function saveLinkViewEdit(root) {
  const selection = currentLinkViewSelection || selectedGraphLink();
  const record = selection?.record || null;
  if (!record?.sourcePath) {
    setLinkViewStatus(root, "No link selected.", "warn");
    return;
  }
  if (!canEditLinkRecord(record)) {
    setLinkViewStatus(root, "This link has no editable source span.", "warn");
    return;
  }

  setLinkViewStatus(root, "Saving...", "");
  try {
    if (window.__nvCodeEditorDirty && sameNotebookPath(window.__nvCodeEditorActivePath, record.sourcePath)) {
      throw new Error("Save or close the dirty source editor before editing this link.");
    }
    const loaded = await fetchNotebookText(record.sourcePath);
    if (loaded.isBinary) {
      throw new Error("Refusing to edit a binary-looking source file.");
    }

    const result = applyLinkRecordEdit(loaded.content, record, readLinkPatchFromForm(root));
    if (!result.changed) {
      setLinkViewStatus(root, "No changes to save.", "warn");
      return;
    }

    await saveNotebookText({
      path: record.sourcePath,
      content: result.content,
      encoding: loaded.encoding,
      bom: loaded.bom,
    });

    const records = await scanFileForLinkRecords(record.sourcePath);
    const next = nextLinkSelectionFromRecords(records, result.updatedRecord || record, selection);
    setSelectedGraphLink(next);
    if (typeof window.refreshGraphManager === "function") {
      await window.refreshGraphManager({ fit: false, reason: "link-file-view-edit" });
    }
    setLinkViewStatus(root, "Saved", "ok");
  } catch (err) {
    console.error("[FileView] Link edit failed:", err);
    setLinkViewStatus(root, err?.message || "Save failed", "error");
  }
}

async function refreshLinkViewRecord(root) {
  const selection = currentLinkViewSelection || selectedGraphLink();
  const record = selection?.record || null;
  if (!record?.sourcePath) return;
  setLinkViewStatus(root, "Refreshing...", "");
  const records = await scanFileForLinkRecords(record.sourcePath);
  const next = nextLinkSelectionFromRecords(records, record, selection);
  setSelectedGraphLink(next);
  setLinkViewStatus(root, next ? "Refreshed" : "No links found in source", next ? "ok" : "warn");
}

function renderLinkEditor(shell, selection) {
  const record = selection?.record || {};
  const canEdit = canEditLinkRecord(record);
  const section = document.createElement("section");
  section.className = "nv-link-file-section";
  const title = document.createElement("h3");
  title.textContent = "Link Editor";
  section.appendChild(title);

  const form = document.createElement("form");
  form.className = "nv-link-file-editor";
  form.append(
    fieldNode({ id: "nv-link-file-target", label: "Link Target", value: record.targetRaw || "", disabled: !record.editableTarget }),
    fieldNode({ id: "nv-link-file-text", label: "Link Text", value: record.linkText || "", disabled: !record.editableText }),
    fieldNode({ id: "nv-link-file-tags", label: "Tags", value: listToCsv(record.tags || []), disabled: !record.editableMetadata, placeholder: "reference, draft" }),
    fieldNode({ id: "nv-link-file-symbols", label: "Symbols", value: normalizeSymbols(record.symbols || []).join(" "), disabled: !record.editableMetadata, placeholder: "*, ?" }),
    fieldNode({ id: "nv-link-file-display", label: "Graph Text", value: record.displayText || "", disabled: !record.editableMetadata })
  );

  const actions = document.createElement("div");
  actions.className = "nv-link-file-actions";
  const saveBtn = makeLinkViewButton("Save Link", "save-link");
  saveBtn.className = "nv-link-file-btn nv-link-file-primary";
  saveBtn.type = "submit";
  saveBtn.disabled = !canEdit;
  const refreshBtn = makeLinkViewButton("Refresh", "refresh-link");
  const sourceBtn = makeLinkViewButton("Open Source", "open-source");
  const targetBtn = makeLinkViewButton("Open Target", "open-target");
  if (record.targetKind === "external") targetBtn.textContent = "Open External";
  actions.append(saveBtn, refreshBtn, sourceBtn, targetBtn);
  form.appendChild(actions);

  const status = document.createElement("div");
  status.className = "nv-link-file-status";
  status.dataset.role = "link-status";
  status.textContent = canEdit ? "" : "This link has no editable source span yet.";
  form.appendChild(status);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveLinkViewEdit(section);
  });
  refreshBtn.addEventListener("click", () => refreshLinkViewRecord(section));
  sourceBtn.addEventListener("click", () => {
    if (record.sourcePath) window.selectedFilePath = record.sourcePath;
  });
  targetBtn.addEventListener("click", () => {
    if (record.targetKind === "external" && record.targetRaw) {
      window.open(record.targetRaw, "_blank", "noopener");
      return;
    }
    const targetPath = normalizeResolvedNotebookPath(record.targetPath || record.targetRaw || "");
    if (targetPath) window.selectedFilePath = targetPath;
  });

  section.appendChild(form);
  shell.appendChild(section);
}

function appendHighlightedText(pre, content, highlights = []) {
  const text = String(content || "");
  const cleanHighlights = highlights
    .filter((item) => item && Number.isFinite(item.start) && Number.isFinite(item.end) && item.start < item.end)
    .map((item) => ({ ...item, start: Math.max(0, item.start), end: Math.min(text.length, item.end) }))
    .filter((item) => item.start < item.end)
    .sort((a, b) => a.start - b.start);

  let offset = 0;
  cleanHighlights.forEach((item) => {
    if (item.start < offset) return;
    if (item.start > offset) pre.appendChild(document.createTextNode(text.slice(offset, item.start)));
    const span = document.createElement("span");
    span.className = "nv-link-file-highlight nv-link-file-highlight-" + item.kind;
    span.textContent = text.slice(item.start, item.end);
    pre.appendChild(span);
    offset = item.end;
  });
  if (offset < text.length) pre.appendChild(document.createTextNode(text.slice(offset)));
}

async function renderSourcePreview(body, record) {
  if (!record?.sourcePath) {
    body.textContent = "No source file recorded.";
    return;
  }
  try {
    const loaded = await fetchNotebookText(record.sourcePath);
    if (loaded.isBinary) {
      body.textContent = "Source file appears to be binary and cannot be shown as text.";
      return;
    }
    body.innerHTML = "";
    const pre = document.createElement("pre");
    pre.className = "nv-link-file-code";
    appendHighlightedText(pre, loaded.content, [
      { ...(record.ranges?.text || {}), kind: "text" },
      { ...(record.ranges?.target || {}), kind: "target" },
    ]);
    body.appendChild(pre);
  } catch (err) {
    body.textContent = err?.message || "Failed to load source file.";
  }
}

async function renderDestinationPreview(body, record) {
  const targetPath = normalizeResolvedNotebookPath(record?.targetPath || record?.targetRaw || "");
  if (record?.targetKind === "external") {
    body.innerHTML = "";
    const link = document.createElement("a");
    link.href = record.targetRaw || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = record.targetRaw || "External link";
    body.appendChild(link);
    return;
  }
  if (!targetPath) {
    body.textContent = "No destination file recorded.";
    return;
  }

  const ext = pathExtension(targetPath);
  const url = ext === "php" ? (window.location.origin + "/php/" + targetPath.split("/").map(encodeURIComponent).join("/")) : notebookAssetUrl(targetPath);
  body.innerHTML = "";

  if (LINK_IMAGE_PREVIEW_EXTS.has(ext) && ext !== "svg") {
    const img = document.createElement("img");
    img.className = "nv-link-file-media";
    img.src = url;
    img.alt = targetPath;
    body.appendChild(img);
    return;
  }
  if (LINK_AUDIO_PREVIEW_EXTS.has(ext)) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = url;
    body.appendChild(audio);
    return;
  }
  if (LINK_VIDEO_PREVIEW_EXTS.has(ext)) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = url;
    video.className = "nv-link-file-media";
    body.appendChild(video);
    return;
  }
  if (["html", "htm", "xhtml", "php", "pdf", "svg"].includes(ext)) {
    const iframe = document.createElement("iframe");
    iframe.className = "nv-link-file-frame";
    iframe.src = url;
    body.appendChild(iframe);
    return;
  }

  try {
    const loaded = await fetchNotebookText(targetPath);
    if (loaded.isBinary || !LINK_TEXT_PREVIEW_EXTS.has(ext)) {
      const iframe = document.createElement("iframe");
      iframe.className = "nv-link-file-frame";
      iframe.src = url;
      body.appendChild(iframe);
      return;
    }
    const pre = document.createElement("pre");
    pre.className = "nv-link-file-code";
    pre.textContent = loaded.content;
    body.appendChild(pre);
  } catch (err) {
    body.textContent = err?.message || "Failed to load destination file.";
  }
}

function renderPreviewSection(shell, titleText, pathText, role) {
  const section = document.createElement("section");
  section.className = "nv-link-file-preview";
  const header = document.createElement("div");
  header.className = "nv-link-file-preview-header";
  const title = document.createElement("h3");
  title.textContent = titleText;
  const path = document.createElement("div");
  path.className = "nv-link-file-preview-path";
  path.textContent = pathText || "None";
  header.append(title, path);
  const body = document.createElement("div");
  body.className = "nv-link-file-preview-body";
  body.textContent = "Loading...";
  section.append(header, body);
  shell.appendChild(section);
  return body;
}

function linkFileViewCss() {
  return `
    .nv-link-file-view{box-sizing:border-box;min-height:100%;padding:14px;color:#172033;background:#f8fafc;font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;flex-direction:column;gap:12px}
    .nv-link-file-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #d8dee9;padding-bottom:10px}
    .nv-link-file-title{font-size:17px;font-weight:750;margin:0;color:#111827;overflow-wrap:anywhere}
    .nv-link-file-subtitle{margin-top:3px;color:#526173;overflow-wrap:anywhere}
    .nv-link-file-section,.nv-link-file-preview{background:#fff;border:1px solid #d8dee9;border-radius:6px;padding:10px;box-shadow:0 1px 2px rgba(15,23,42,.05)}
    .nv-link-file-section h3,.nv-link-file-preview h3{font-size:13px;margin:0 0 8px;font-weight:750;color:#1f2937}
    .nv-link-file-details{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:7px 12px}
    .nv-link-file-detail-row{display:grid;grid-template-columns:minmax(92px,.36fr) minmax(0,1fr);gap:8px;align-items:start;min-width:0}
    .nv-link-file-label,.nv-link-file-field span{font-weight:650;color:#475569}
    .nv-link-file-value{min-width:0;overflow-wrap:anywhere;color:#172033}
    .nv-link-file-select,.nv-link-file-field input,.nv-link-file-btn{font:inherit;border:1px solid #cbd5e1;background:#fff;color:#172033;border-radius:5px;box-sizing:border-box}
    .nv-link-file-select{width:100%;padding:6px 8px}
    .nv-link-file-editor{display:grid;gap:8px}
    .nv-link-file-field{display:grid;grid-template-columns:minmax(95px,.26fr) minmax(0,1fr);gap:8px;align-items:center}
    .nv-link-file-field input{min-width:0;width:100%;padding:6px 8px}
    .nv-link-file-field input:disabled{background:#f1f5f9;color:#64748b}
    .nv-link-file-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
    .nv-link-file-btn{padding:5px 9px;cursor:pointer}
    .nv-link-file-btn:disabled{cursor:not-allowed;opacity:.55}
    .nv-link-file-primary{background:#1f6feb;color:#fff;border-color:#1f6feb}
    .nv-link-file-status{font-size:12px;color:#64748b;min-height:17px}
    .nv-link-file-status[data-kind="ok"]{color:#15803d}.nv-link-file-status[data-kind="warn"]{color:#a16207}.nv-link-file-status[data-kind="error"]{color:#b91c1c}
    .nv-link-file-previews{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;align-items:stretch}
    .nv-link-file-preview{display:flex;flex-direction:column;min-height:360px;min-width:0}
    .nv-link-file-preview-header{border-bottom:1px solid #e2e8f0;margin-bottom:8px;padding-bottom:7px}
    .nv-link-file-preview-path{font-size:12px;color:#64748b;overflow-wrap:anywhere}
    .nv-link-file-preview-body{min-height:0;flex:1;overflow:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:8px;box-sizing:border-box}
    .nv-link-file-code{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;color:#111827}
    .nv-link-file-highlight{border-radius:3px;padding:0 2px}.nv-link-file-highlight-target{background:#fde68a}.nv-link-file-highlight-text{background:#bfdbfe}
    .nv-link-file-frame{width:100%;height:100%;min-height:320px;border:0;background:#fff}.nv-link-file-media{max-width:100%;max-height:100%;display:block;margin:auto}
  `;
}

export async function showGraphLinkInFileView(selection = selectedGraphLink()) {
  const viewPanel = getViewPanelElement();
  const record = selection?.record || null;
  if (!viewPanel || !record) return false;

  if (typeof viewPanel._dispose === "function") {
    try { viewPanel._dispose(); } catch (err) { console.warn("[FileView] Previous viewer cleanup failed:", err); }
    viewPanel._dispose = null;
  }

  currentLinkViewSelection = selection;
  lastRenderedPath = null;
  viewPanel.innerHTML = "";
  const owningCell = viewPanel.closest(".panel-cell");
  owningCell?.removeAttribute("data-current-file-path");
  owningCell?.setAttribute("data-current-link-id", selection.edgeId || record.id || "link");
  setFileViewStatus("Link Viewer", summarizeLinkRecord(record));
  updateToolbarState({ currentMode: "LinkViewing", selectedGraphLink: selection });
  activateFileViewPanel();

  const style = document.createElement("style");
  style.textContent = linkFileViewCss();
  const shell = document.createElement("div");
  shell.className = "nv-link-file-view";

  const header = document.createElement("header");
  header.className = "nv-link-file-header";
  const headerText = document.createElement("div");
  const title = document.createElement("h2");
  title.className = "nv-link-file-title";
  title.textContent = summarizeLinkRecord(record);
  const subtitle = document.createElement("div");
  subtitle.className = "nv-link-file-subtitle";
  subtitle.textContent = (record.sourcePath || "Unknown source") + " -> " + linkTargetDisplay(record);
  headerText.append(title, subtitle);
  header.appendChild(headerText);
  shell.appendChild(header);

  renderLinkOccurrenceSelector(shell, selection);
  renderLinkDescription(shell, selection);
  renderLinkEditor(shell, selection);

  const previews = document.createElement("div");
  previews.className = "nv-link-file-previews";
  shell.appendChild(previews);
  const sourceBody = renderPreviewSection(previews, "Source File", record.sourcePath || "", "source");
  const destinationBody = renderPreviewSection(previews, "Destination File", linkTargetDisplay(record), "destination");

  viewPanel.append(style, shell);
  renderSourcePreview(sourceBody, record);
  renderDestinationPreview(destinationBody, record);
  return true;
}

function installGraphLinkFileViewHandler() {
  if (window.__nvGraphLinkFileViewHandlerInstalled) return;
  window.__nvGraphLinkFileViewHandlerInstalled = true;
  window.showGraphLinkInFileView = showGraphLinkInFileView;
  window.addEventListener("nodevision-graph-link-selected", (event) => {
    const selection = event.detail?.selection || null;
    if (selection?.record) {
      showGraphLinkInFileView(selection).catch((err) => console.warn("[FileView] Link view render failed:", err));
    }
  });
}

function normalizeNotebookPath(value) {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";

  try {
    const parsed = new URL(cleaned, window.location.origin);
    cleaned = parsed.pathname || cleaned;
  } catch {
    // Keep raw value when it is not a URL.
  }

  cleaned = cleaned
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "");

  if (cleaned.toLowerCase().startsWith("notebook/")) {
    cleaned = cleaned.slice("Notebook/".length);
  }

  return cleaned.trim();
}

function getActiveFilePath(preferredPath = null) {
  const candidates = [
    preferredPath,
    window.currentActiveFilePath,
    window.NodevisionState?.activeEditorFilePath,
    window.selectedFilePath,
    window.NodevisionState?.selectedFile,
    window.ActiveNode,
    window.filePath,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeNotebookPath(candidate);
    if (normalized) return normalized;
  }

  return "";
}

function getViewPanelElement() {
  if (viewDivRef && document.body.contains(viewDivRef)) {
    return viewDivRef;
  }

  const cell = getFileViewCell();
  const fromCell = cell?.querySelector?.("#element-view");
  if (fromCell) return fromCell;

  return document.getElementById("element-view");
}

function setFileViewStatus(message, detail = "") {
  try {
    setStatus(message, detail);
  } catch (err) {
    console.warn("[FileView] Failed to update status bar:", err);
  }
}

async function loadModuleMap() {
  // Only use cache if it has actual entries (not empty from failed load)
  if (moduleMapCache && Object.keys(moduleMapCache).length > 0) {
    return moduleMapCache;
  }

  try {
    // Use relative path - browser will resolve through current origin/proxy
    const csvUrl = "/PanelInstances/ModuleMap.csv";
    console.log("📦 Fetching ModuleMap from:", csvUrl);
    const res = await fetch(csvUrl, { cache: "no-store" });
    console.log("📦 ModuleMap fetch status:", res.status, res.statusText);
    if (!res.ok) {
      console.error("❌ Failed to load ModuleMap.csv, status:", res.status);
      // Don't cache failures - allow retry
      return {};
    }

    const text = await res.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    const header = lines.shift().split(",").map(h => h.trim());
    const idx = {
      ext: header.indexOf("Extension"),
      viewer: header.indexOf("ViewerModule"),
      editor: header.indexOf("GraphicalEditorModule"),
    };

    const map = {};

    for (const line of lines) {
      const cols = line.split(",").map(c => c.trim());
      const ext = cols[idx.ext] || "";
      map[ext.toLowerCase()] = {
        viewer: cols[idx.viewer] || null,
        editor: cols[idx.editor] || null,
      };
    }

    moduleMapCache = map;
    console.log("📦 moduleMap loaded:", map);
    return map;
  } catch (err) {
    console.error("❌ Error loading ModuleMap.csv:", err);
    moduleMapCache = {};
    return moduleMapCache;
  }
}

function resolveExtension(filename) {
  const raw = String(filename || "").trim();
  if (!raw) return "";

  const readExtensionFromPathLike = (pathLike = "") => {
    const clean = String(pathLike || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/[?#].*$/, "");
    if (!clean) return "";

    const lower = clean.toLowerCase().replace(/%2e/gi, ".");
    if (lower.endsWith(".alto.xml")) return "alto";
    if (lower.endsWith(".musicxml.xml")) return "musicxml"; // future-proofing
    if (lower.endsWith(".td.json")) return "td.json";
    if (lower.endsWith(".terrain.json")) return "terrain.json";
    if (lower.endsWith(".tar.gz")) return "tar.gz"; // optional

    const lastSegment = lower.split("/").pop() || lower;
    if (lastSegment.includes(".")) {
      const token = (lastSegment.split(".").pop() || "").trim().toLowerCase();
      const sanitized = token.replace(/[^a-z0-9_+-]/g, "");
      if (sanitized) return sanitized;
    }

    if (/\.ico(?=$|[^a-z0-9_+-])/i.test(lower)) return "ico";
    return "";
  };

  const candidates = [];
  const pushCandidate = (value) => {
    if (!value) return;
    const text = String(value).trim();
    if (!text) return;
    candidates.push(text);
    try {
      const decoded = decodeURIComponent(text);
      if (decoded && decoded !== text) candidates.push(decoded);
    } catch {
      // Keep undecoded candidate only.
    }
  };

  pushCandidate(raw);

  try {
    const parsed = new URL(raw, window.location.origin);
    pushCandidate(parsed.pathname || "");
    ["path", "file", "filename", "filepath", "selectedFilePath"].forEach((key) =>
      pushCandidate(parsed.searchParams.get(key) || "")
    );
    for (const value of parsed.searchParams.values()) {
      pushCandidate(value);
    }
  } catch {
    const [withoutHash] = raw.split("#");
    const [pathPart, queryPart = ""] = withoutHash.split("?");
    pushCandidate(pathPart);
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      ["path", "file", "filename", "filepath", "selectedFilePath"].forEach((key) =>
        pushCandidate(params.get(key) || "")
      );
      for (const value of params.values()) {
        pushCandidate(value);
      }
    }
  }

  for (const candidate of [...new Set(candidates)]) {
    const ext = readExtensionFromPathLike(candidate);
    if (ext) return ext;
  }

  return "";
}

function activateFileViewPanel() {
  const cell = getFileViewCell();
  if (!cell) return;

  window.activeCell = cell;
  window.activePanel = "FileView";
  window.activePanelClass = cell.dataset.panelClass || "ViewPanel";
  if (window.NodevisionState) {
    window.NodevisionState.activePanelType = window.activePanelClass;
  }

  if (window.highlightActiveCell) {
    window.highlightActiveCell(cell);
  }

  window.dispatchEvent(new CustomEvent("activePanelChanged", {
    detail: { panel: "FileView", cell, panelClass: window.activePanelClass }
  }));
}

function enableViewActivation(viewDiv) {
  if (!viewDiv) return;
  const handler = () => activateFileViewPanel();
  viewDiv.addEventListener("pointerdown", handler, { capture: true });
  viewDiv.addEventListener("mousedown", handler, { capture: true });
  viewDiv.addEventListener("click", handler, { capture: true });
  viewDiv.addEventListener("pointerenter", handler, { capture: true });
  viewDiv.addEventListener("mouseenter", handler, { capture: true });
  viewDiv.addEventListener("focusin", handler, { capture: true });
}

function getFileViewCell() {
  if (viewDivRef) {
    const cell = viewDivRef.closest?.(".panel-cell");
    if (cell && document.body.contains(cell)) {
      return cell;
    }
  }
  return document.querySelector(`[data-id="FileView"]`);
}

function installFileViewPointerTracking() {
  if (window.__nvFileViewPointerTrackingInstalled) return;

  const handler = (event) => {
    if (!event?.target) return;
    const cell = getFileViewCell();
    if (!cell || !cell.contains(event.target)) return;
    activateFileViewPanel();
  };

  document.addEventListener("pointerdown", handler, true);
  document.addEventListener("mousedown", handler, true);
  window.__nvFileViewPointerTrackingInstalled = true;
}

function installFileViewFocusHandler() {
  if (window.__nvFileViewFocusHandlerInstalled) return;

  const focusHandler = (event) => {
    const cell = getFileViewCell();
    if (!cell || !cell.contains(event?.target)) {
      return;
    }
    activateFileViewPanel();
  };

  document.addEventListener("focusin", focusHandler, true);
  window.__nvFileViewFocusHandlerInstalled = true;
}

function handleFileSavedForView(event) {
  try {
    const savedPath = event?.detail?.filePath;
    if (!savedPath) return;

    if (savedPath === lastRenderedPath) {
      console.log("📡 FileViewer live-refresh for:", savedPath);
      updateViewPanel(savedPath, { force: true }).catch((err) => {
        console.error("❌ Live-refresh updateViewPanel failed:", err);
      });
    }
  } catch (err) {
    console.error("❌ Live-refresh handler error:", err);
  }
}

function installFileViewLiveRefresh() {
  if (window.__nvFileViewLiveRefreshInstalled) return;
  window.addEventListener("nodevision-file-saved", handleFileSavedForView);
  window.__nvFileViewLiveRefreshInstalled = true;
}

function attachIframeActivation(node) {
  if (!node) return;
  if (node instanceof HTMLIFrameElement) {
    installIframeActivation(node);
  } else if (node.querySelectorAll) {
    node.querySelectorAll("iframe").forEach((iframe) => installIframeActivation(iframe));
  }
}

function observeViewIframes(viewDiv) {
  if (!viewDiv) return;
  if (viewDiv.__nvIframeObserver) return;

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        attachIframeActivation(node);
      }
    }
  });

  viewDiv.__nvIframeObserver = observer;
  observer.observe(viewDiv, { childList: true, subtree: true });
  attachIframeActivation(viewDiv);
}

function installIframeActivation(iframe) {
  if (!iframe) return;
  if (iframe.__nvFileViewActivationAttached) return;
  iframe.__nvFileViewActivationAttached = true;

  const handler = () => activateFileViewPanel();

  const tryAttachDocument = () => {
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      if (!doc.__nvFileViewLinkNavigationAttached) {
        doc.__nvFileViewLinkNavigationAttached = true;
        doc.addEventListener("click", handleFileViewLinkClick, { capture: true });
      }
      if (doc.__nvFileViewActivationAttached) return;
      doc.__nvFileViewActivationAttached = true;
      doc.addEventListener("click", handler, { capture: true });
      doc.addEventListener("mousedown", handler, { capture: true });
      doc.addEventListener("pointerdown", handler, { capture: true });
      doc.addEventListener("focusin", handler, { capture: true });
    } catch (err) {
      // Accessing cross-origin documents will throw; ignore indicator.
    }
  };

  iframe.addEventListener("mousedown", handler, { capture: true });
  iframe.addEventListener("click", handler, { capture: true });
  iframe.addEventListener("pointerenter", handler, { capture: true });
  iframe.addEventListener("mouseenter", handler, { capture: true });
  iframe.addEventListener("pointerdown", handler, { capture: true });
  iframe.addEventListener("focus", handler, true);
  iframe.addEventListener("load", () => {
    tryAttachDocument();
    tryScrollToPendingFileViewAnchor(getActiveFilePath());
  });
  tryAttachDocument();
}


export async function setupPanel(panel, instanceVars = {}) {
  // Create container for view content
  const viewDiv = document.createElement("div");
  viewDiv.id = "element-view";
  viewDiv.style.width = "100%";
  viewDiv.style.height = "100%";
  viewDiv.style.overflow = "auto";
  viewDivRef = viewDiv;
  panel.appendChild(viewDiv);
  enableViewActivation(viewDiv);
  installFileViewLinkNavigation(viewDiv);
  observeViewIframes(viewDiv);
  installFileViewPointerTracking();
  installFileViewFocusHandler();
  installFileViewLiveRefresh();
  installGraphLinkFileViewHandler();

  // Reactive watcher for window.selectedFilePath
  if (!window._selectedFileProxyInstalled) {
    let internalPath = window.selectedFilePath || null;

    Object.defineProperty(window, "selectedFilePath", {
      get() {
        return internalPath;
      },
      set(value) {
        if (value !== internalPath) {
          const applyChange = () => {
            console.log("📂 selectedFilePath changed:", value);
            internalPath = value;
            window.NodevisionState = window.NodevisionState || {};
            window.NodevisionState.selectedFile = internalPath || null;
            try {
              updateToolbarState({ selectedFile: window.NodevisionState.selectedFile });
            } catch (err) {
              console.warn("Failed to update toolbar state for selectedFilePath change:", err);
            }
            const viewPanel = getViewPanelElement();
            if (viewPanel) {
              updateViewPanel(value, { force: true }).catch(err => {
                console.error("❌ updateViewPanel error:", err);
              });
            }

            const codeEditorActive = typeof window.isCodeEditorActive === "function" ? window.isCodeEditorActive() : false;
            if (codeEditorActive && typeof window.updateEditorPanel === "function") {
              window.NodevisionState.activeEditorFilePath = value;
              window.currentActiveFilePath = value;
              window.updateEditorPanel(value);
            }
          };

          if (typeof window.__nvGuardFileSwitch === "function") {
            window.__nvGuardFileSwitch(value, applyChange);
          } else {
            applyChange();
          }
        }
      },
      configurable: true,
    });

    window._selectedFileProxyInstalled = true;
    console.log("✅ Reactive selectedFilePath watcher installed.");
  }

  // Listen for iframe -> parent click messages
  window.addEventListener("message", (event) => {
    if (event.data?.type === "activatePanel" && event.data?.id === "FileView") {
      activateFileViewPanel();
      console.log("Active panel via postMessage:", window.activePanel);
    }
  });

  const activeGraphLinkSelection = selectedGraphLink();
  if (activeGraphLinkSelection?.record) {
    await showGraphLinkInFileView(activeGraphLinkSelection);
    return;
  }

  const initialPath = getActiveFilePath(instanceVars.filePath);
  if (!initialPath) {
    console.warn("⚠️ FileView activated with no active file selected.");
    setFileViewStatus("File Viewer", "No active file selected");
    const viewPanel = getViewPanelElement();
    if (viewPanel) {
      viewPanel.innerHTML = "<em>No active file selected.</em>";
    }
    return;
  }

  console.log("📂 FileView activation resolved path:", initialPath);
  setFileViewStatus("File Viewer", initialPath);

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = initialPath;
  window.currentActiveFilePath = initialPath;
  panel.dataset.currentFilePath = initialPath;

  if (window.selectedFilePath !== initialPath) {
    window.selectedFilePath = initialPath;
  }

  lastRenderedPath = null;
  try {
    await updateViewPanel(initialPath, { force: true });
  } catch (err) {
    console.error("❌ Initial updateViewPanel error:", err);
    setFileViewStatus("File Viewer", `Render failed: ${err?.message || err}`);
  }
}

export async function updateViewPanel(element, { force = false } = {}) {
  const viewPanel = getViewPanelElement();
  if (!viewPanel) {
    console.error("View panel element not found.");
    setFileViewStatus("File Viewer", "Render failed: panel not found");
    return false;
  }

  const filename = getActiveFilePath(element);
  if (!filename) {
    viewPanel.innerHTML = "<em>No file selected.</em>";
    console.warn("⚠️ FileView update aborted: no active file selected.");
    setFileViewStatus("File Viewer", "No active file selected");
    return false;
  }

  currentLinkViewSelection = null;
  viewPanel.closest(".panel-cell")?.removeAttribute("data-current-link-id");

  console.log("📍 FileView resolved path:", filename);
  viewPanel.closest(".panel-cell")?.setAttribute("data-current-file-path", filename);

  // Skip rendering for directories (no extension or known directory names)
  const ext = resolveExtension(filename);
  const lowerFilename = filename.toLowerCase();
  if (!ext || lowerFilename === ext || !filename.includes('.')) {
    if (typeof viewPanel._dispose === "function") {
      try {
        viewPanel._dispose();
      } catch (err) {
        console.warn("[FileView] Previous viewer cleanup failed:", err);
      }
      viewPanel._dispose = null;
    }
    viewPanel.innerHTML = "";
    lastRenderedPath = null;
    console.log("📁 Skipping directory view for:", filename);
    setFileViewStatus("File Viewer", `Directory selected: ${filename}`);
    return false;
  }

  // Prevent redundant rerenders unless forced
  if (!force && filename === lastRenderedPath) {
    console.log("🔁 File already displayed:", filename);
    setFileViewStatus("File Viewer", filename);
    return true;
  }
  lastRenderedPath = filename;

  console.log("🧭 Updating view panel for file:", filename);
  window.currentActiveFilePath = filename;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = filename;
  window.NodevisionModelExportContext = null;
  updateToolbarState({ currentMode: "Default", selectedFile: filename, modelCanExportSTL: false });
  setFileViewStatus("File Viewer", filename);
  if (typeof viewPanel._dispose === "function") {
    try {
      viewPanel._dispose();
    } catch (err) {
      console.warn("[FileView] Previous viewer cleanup failed:", err);
    }
    viewPanel._dispose = null;
  }
  viewPanel.innerHTML = "";

  // Determine server base depending on file type
  const isPHP = ext === "php";
  const origin = window.location.origin;
  const serverBase = isPHP ? `${origin}/php` : `${origin}/Notebook`;

  const success = await renderFile(filename, viewPanel, serverBase);
  if (success) {
    setFileViewStatus("File Viewer", `Loaded: ${filename}`);
    tryScrollToPendingFileViewAnchor(filename);
  } else {
    setFileViewStatus("File Viewer", `Render failed: ${filename}`);
  }
  return success;
}

async function renderFile(filename, viewPanel, serverBase) {
  console.log(`📄 renderFile() called for: ${filename}`);
  let iframe = null;

  try {
    // 1. Get the module map from the CSV file
    console.log("📦 Loading module map...");
    const moduleMap = await loadModuleMap();
    console.log("📦 Module map loaded, keys:", Object.keys(moduleMap).slice(0, 10));
    const basePath = "/PanelInstances/ViewPanels/FileViewers";

    // 2. Determine file extension and lookup viewer
    const ext = resolveExtension(filename);

    // Use ViewText.mjs as fallback if no extension or mapping exists
    const viewerInfo = moduleMap[ext] || moduleMap[""] || { viewer: "ViewText.mjs" };
    let viewerFile = viewerInfo.viewer;

    if (!viewerFile) {
      console.warn(`⚠️ No viewer module defined for extension: ${ext}. Defaulting to ViewText.mjs.`);
      viewerFile = "ViewText.mjs";
    }

    const modulePath = `${basePath}/${viewerFile}`;
    console.log(`🔍 Loading viewer module: ${modulePath}`);

    const viewer = await import(modulePath);

    // Let viewer specify if it wants an iframe
    const wantsIframe = viewer.wantsIframe === true;

    if (wantsIframe) {
      iframe = document.createElement("iframe");
      Object.assign(iframe.style, {
        width: "100%",
        height: "100%",
        border: "none"
      });
      iframe.src = "about:blank";
      viewPanel.appendChild(iframe);
      installIframeActivation(iframe);
    }

    const normalizeNotebookPath = (value) => {
      let cleaned = String(value || "").replace(/\\/g, "/").trim();
      cleaned = cleaned.replace(/^\/+/, "");
      if (cleaned.toLowerCase().startsWith("notebook/")) {
        cleaned = cleaned.slice("Notebook/".length);
      }
      return cleaned;
    };

    // Normalize paths so viewers consistently receive Notebook-relative paths.
    // (Some panels emit "Notebook/..." or "/Notebook/..."-prefixed values.)
    let cleanPath = normalizeNotebookPath(filename);
    // Check viewerFile instead of ext for robustness against future changes.
    // PHP uses a separate proxy/root, but still expects Notebook-relative paths.
    if (viewerFile === "ViewPHP.mjs") {
      cleanPath = normalizeNotebookPath(cleanPath);
    }

    // Call viewer
    const renderResult = await viewer.renderFile(cleanPath, viewPanel, iframe, serverBase);
    if (renderResult === false) {
      console.warn(`⚠️ Viewer reported render failure: ${viewerFile}`);
      return false;
    }

    console.log(`✅ Rendered with ${viewerFile}`);
    return true;

  } catch (err) {
    console.error(`❌ renderFile failed for ${filename}:`, err);
    viewPanel.innerHTML = `<em>Error loading viewer for ${filename}: ${err.message}</em>`;
    return false;

  } finally {
    installIframeActivation(iframe);
  }
}

// Expose globally
window.updateViewPanel = updateViewPanel;
window.renderFile = renderFile;

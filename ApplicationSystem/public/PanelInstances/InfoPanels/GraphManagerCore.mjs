// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerCore.mjs
// This file defines browser-side Graph Manager Core logic for the Nodevision UI. It renders interface components and handles user interactions.
import { requestNodevisionFileSelection } from '/EditorSwitchGuard.mjs';
import { scanFileForLinkRecords } from './GraphManagerDependencies/ScanForLinks.mjs';
import { buildSelectedGraphLink, linkRecordTargetId, makeEdgeLabel, setSelectedGraphLink, summarizeLinkRecord } from './GraphManagerDependencies/LinkRecords.mjs';
import { saveFoundEdge } from './GraphManagerDependencies/SaveFoundEdge.mjs';
import { getVisibleNodeId } from './GraphManagerDependencies/GetVisibleNodeID.mjs';
import { normalizePath } from './GraphManagerDependencies/NormalizePath.mjs';
import { fetchDirectoryContents as fetchDirectoryContentsAPI, moveFileOrDirectory } from '/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerAPI.mjs';
import { maybePromptLinkMoveImpact } from '/ToolbarCallbacks/file/linkMoveImpact.mjs';
import { getNodevisionNavigationState } from '/NodevisionNavigationState.mjs';
import { attachMqttGraphLayer, MQTT_GRAPH_STYLE } from './GraphManagerDependencies/MQTTGraphAdapter.mjs';
import { attachThingDescriptionGraphLayer, THING_DESCRIPTION_GRAPH_STYLE } from './GraphManagerDependencies/ThingDescriptionGraphAdapter.mjs';

let cy;
let mqttGraphLayer = null;
let tdGraphLayer = null;
let currentRootPath = '';
const discoveredLinks = new Map(); // sourcePath -> Set(targetPath)
const linkRecordsBySourceTarget = new Map(); // sourcePath + targetPath -> link records[]
let linkInspectorElem = null;
const brokenLinksBySource = new Map(); // sourcePath -> Set(brokenTargetPath)
let layoutHasInitialized = false;
let activeLayout = null;
let layoutDebounceTimer = null;
let layoutPendingFit = false;
let layoutPendingReasons = new Set();
let dragMoveState = null;
let expandedDirectoryCollisionFrame = null;
let expandedDirectoryCollisionNodeId = null;
const htmlPreviewCache = new Map(); // path -> url | null
let externalNodesLoaded = false;
const EDGE_BUCKET_SYMBOLS = [
    ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ...'0123456789',
    '#',
    '_'
];
const DIRECTORY_IMAGE_CANDIDATES = [
    '.directory.svg',
    'directory.svg',
    '.directory.png',
    'directory.png',
];
const BROKEN_LINK_BADGE_URL =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23fbc02d" d="M1 21h22L12 2 1 21z"/><path fill="%23000" d="M12 8.5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1s1-.45 1-1v-4c0-.55-.45-1-1-1zm0 7c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>';
const DIRECTORY_NOTEBOOK_COLOR = "#e5e7eb";
const DIRECTORY_COLOR_FAMILIES = [
    ["#8b5cf6", "#a855f7", "#7c3aed", "#c084fc"],
    ["#2563eb", "#3b82f6", "#1d4ed8", "#60a5fa"],
    ["#06b6d4", "#0891b2", "#22d3ee", "#0e7490"],
    ["#22c55e", "#16a34a", "#10b981", "#15803d"],
    ["#eab308", "#facc15", "#ca8a04", "#fde047"],
    ["#f97316", "#fb923c", "#ea580c", "#fdba74"],
    ["#dc2626", "#ef4444", "#b91c1c", "#f87171"],
];
const DIRECTORY_EXPANDED_TINT_SURFACE = "#f8fafc";
const DIRECTORY_EXPANDED_TINT_AMOUNT = 0.42;
const DIRECTORY_BORDER_DARKEN_AMOUNT = 0.22;
const EXPANDED_DIRECTORY_PARENT_MARGIN = 28;
const EXPANDED_DIRECTORY_COLLISION_GAP = 36;
const EXPANDED_DIRECTORY_COLLISION_MAX_PASSES = 6;
const CLIPBOARD_SHORTCUTS = {
    c: "copyFile",
    v: "pasteFile",
    x: "cutFile"
};
const navigationState = getNodevisionNavigationState();

async function fetchDirectoryContents(path, callback, errorElem, loadingElem) {
    try {
        if (loadingElem) loadingElem.style.display = "block";
        const cleanPath = normalizePath(path || "");
        const data = await fetchDirectoryContentsAPI(cleanPath);

        if (typeof callback === "function") {
            callback(data, cleanPath);
        }

        navigationState.setLastOpenedDirectory(cleanPath, "GraphManager");
        return data;
    } catch (err) {
        console.error("[GraphManager] Failed to fetch directory:", path, err);
        if (errorElem) {
            errorElem.textContent = err?.message || String(err);
        }
        return null;
    } finally {
        if (loadingElem) loadingElem.style.display = "none";
    }
}

async function loadGraphStylesJson() {
    const candidates = [
        '/GraphStyles.json',
        '/GraphManagement/GraphStyles.json',
        'GraphStyles.json'
    ];

    for (const url of candidates) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) continue;
            const json = await res.json();
            if (json && typeof json === 'object') return json;
        } catch (_) {
            // ignore and try next candidate
        }
    }
    return null;
}

async function loadEdgeStyleOverrides() {
    const styles = await loadGraphStylesJson();
    const edge = styles?.edge;
    return edge && typeof edge === 'object' ? edge : null;
}

function isHttpLink(link = '') {
    // Match http:// or https:// (escape each slash once so the regex literal parses correctly)
    return /^https?:\/\//i.test(String(link || ''));
}

function makeExternalNodeFromUrl(rawUrl) {
    try {
        const url = String(rawUrl || '').trim();
        if (!isHttpLink(url)) return null;
        const parsed = new URL(url);
        const label = parsed.hostname || url;
        const id = `external:${encodeURIComponent(url)}`;
        return {
            id,
            label,
            url,
            type: 'external',
            category: 'website',
            description: `External link to ${label}`,
            createdAt: new Date().toISOString(),
            source: 'link-scan'
        };
    } catch (_) {
        return null;
    }
}

async function persistExternalNodes(nodes = []) {
    try {
        const res = await fetch('/api/graph/external/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nodes)
        });
        if (!res.ok) {
            console.warn('[GraphManager] Failed to persist external nodes:', res.statusText);
        }
    } catch (err) {
        console.warn('[GraphManager] Error persisting external nodes:', err);
    }
}

async function fetchExternalNodes() {
    try {
        const res = await fetch('/api/graph/external/nodes', { cache: 'no-store' });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : [];
    } catch (err) {
        console.warn('[GraphManager] Failed to fetch external nodes:', err);
        return [];
    }
}

function addExternalNodesToGraph(nodes = []) {
    if (!cy) return;
    const elements = [];
    nodes.forEach((node) => {
        if (!node || typeof node !== 'object') return;
        const id = String(node.id || '').trim();
        const label = String(node.label || id || '').trim();
        const url = String(node.url || '').trim();
        if (!id || !label || !url) return;

        if (cy.getElementById(id).empty()) {
            elements.push({
                group: 'nodes',
                data: {
                    id,
                    label,
                    type: 'external',
                    url,
                    category: node.category || 'website',
                    description: node.description || '',
                    createdAt: node.createdAt || '',
                    source: node.source || ''
                }
            });
        } else {
            const existing = cy.getElementById(id);
            existing.data('label', label);
            existing.data('url', url);
            existing.data('category', node.category || 'website');
            existing.data('description', node.description || '');
            existing.data('createdAt', node.createdAt || '');
            existing.data('source', node.source || '');
        }
    });

    if (elements.length) {
        cy.add(elements);
        queueRelayout({ fit: true, reason: 'external-nodes' });
    }
}

async function loadExternalNodes() {
    if (externalNodesLoaded) return;
    const nodes = await fetchExternalNodes();
    addExternalNodesToGraph(nodes);
    externalNodesLoaded = true;
}

function toNotebookAssetUrl(relativePath) {
  const parts = String(relativePath)
      .split(/[\\/]+/)
        .filter(Boolean)
        .map(encodeURIComponent);
    return `/Notebook/${parts.join('/')}`;
}

async function findFirstImageInHtml(path) {
    if (htmlPreviewCache.has(path)) return htmlPreviewCache.get(path);
    try {
        const res = await fetch(toNotebookAssetUrl(path), { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const match = text.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (!match) {
            htmlPreviewCache.set(path, null);
            return null;
        }
        const rawSrc = match[1];
        const resolved = resolveNotebookLink(path, rawSrc);
        const url = resolved ? toNotebookAssetUrl(resolved) : null;
        htmlPreviewCache.set(path, url);
        return url;
    } catch (_) {
        htmlPreviewCache.set(path, null);
        return null;
    }
}

function inferCurrentDirectoryImage(files, parentPath) {
    if (!Array.isArray(files)) return '';

    for (const candidate of DIRECTORY_IMAGE_CANDIDATES) {
        const hit = files.find((entry) => {
            if (!entry || entry.isDirectory) return false;
            const name = String(entry.name || '').toLowerCase();
            return name === candidate.toLowerCase();
        });
        if (!hit) continue;

        const actualName = hit.name || candidate;
        const relBase = normalizePath(parentPath);
        const rel = relBase ? `${relBase}/${actualName}` : actualName;

        if (typeof hit.path === 'string' && hit.path) {
            return toNotebookAssetUrl(hit.path);
        }
        return toNotebookAssetUrl(rel);
    }

    return '';
}

function isExternalOrAnchorLink(link) {
    return (
        link.startsWith('http://') ||
        link.startsWith('https://') ||
        link.startsWith('//') ||
        link.startsWith('mailto:') ||
        link.startsWith('javascript:') ||
        link.startsWith('data:') ||
        link.startsWith('#')
    );
}

function normalizeNotebookRelativePath(path) {
    const parts = [];
    for (const part of path.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
            if (parts.length === 0) return null;
            parts.pop();
            continue;
        }
        parts.push(part);
    }
    return parts.join('/');
}

function resolveNotebookLink(sourceFilePath, rawLink) {
    if (typeof rawLink !== 'string') return null;
    let link = rawLink.trim();
    if (!link || isExternalOrAnchorLink(link)) return null;

    const hashIndex = link.indexOf('#');
    if (hashIndex >= 0) link = link.slice(0, hashIndex);
    const queryIndex = link.indexOf('?');
    if (queryIndex >= 0) link = link.slice(0, queryIndex);
    if (!link) return null;

    const sourceDir = sourceFilePath.includes('/') ? sourceFilePath.slice(0, sourceFilePath.lastIndexOf('/')) : '';
    const isRootRelative = rawLink.startsWith('/') || rawLink.startsWith('Notebook/');
    let candidate = link.replace(/^\/+/, '');
    if (candidate.startsWith('Notebook/')) {
        candidate = candidate.slice('Notebook/'.length);
    } else if (!isRootRelative && sourceDir) {
        candidate = `${sourceDir}/${candidate}`;
    }

    return normalizeNotebookRelativePath(candidate);
}


function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function hexToRgb(hex) {
    const clean = String(hex || "").replace(/^#/, "");
    const value = clean.length === 3
        ? clean.split("").map((ch) => ch + ch).join("")
        : clean.padEnd(6, "0").slice(0, 6);
    const num = Number.parseInt(value, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
    };
}

function rgbToHex({ r, g, b }) {
    return "#" + [r, g, b]
        .map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0"))
        .join("");
}

function mixHexColors(fromHex, toHex, amount) {
    const t = clamp01(amount);
    const from = hexToRgb(fromHex);
    const to = hexToRgb(toHex);
    return rgbToHex({
        r: from.r + (to.r - from.r) * t,
        g: from.g + (to.g - from.g) * t,
        b: from.b + (to.b - from.b) * t,
    });
}

function directoryDepth(pathValue = "") {
    const clean = normalizePath(pathValue || "");
    if (!clean) return 0;
    return clean.split("/").filter(Boolean).length;
}

function directoryVisualLevel(pathValue = "") {
    const clean = normalizePath(pathValue || "");
    if (!clean) return -1;
    return Math.max(0, directoryDepth(clean) - 1);
}

function directoryColorForLevel(level) {
    if (level < 0) return DIRECTORY_NOTEBOOK_COLOR;
    const familyIndex = level % DIRECTORY_COLOR_FAMILIES.length;
    const family = DIRECTORY_COLOR_FAMILIES[familyIndex] || DIRECTORY_COLOR_FAMILIES[0];
    const shadeIndex = Math.floor(level / DIRECTORY_COLOR_FAMILIES.length) % family.length;
    return family[shadeIndex];
}

function directoryVisualData(pathValue = "") {
    const level = directoryVisualLevel(pathValue);
    const color = directoryColorForLevel(level);
    return {
        directoryLevel: level,
        directoryColor: color,
        directoryFillColor: mixHexColors(color, DIRECTORY_EXPANDED_TINT_SURFACE, DIRECTORY_EXPANDED_TINT_AMOUNT),
        directoryBorderColor: mixHexColors(color, "#111827", DIRECTORY_BORDER_DARKEN_AMOUNT),
    };
}

function updateDirectoryLevelColors() {
    if (!cy) return;
    const directories = cy.nodes('node[type="directory"]');
    if (!directories.length) return;

    directories.forEach((node) => {
        const visual = directoryVisualData(node.data("fullPath") || node.id());
        node.data("directoryLevel", visual.directoryLevel);
        node.data("directoryColor", visual.directoryColor);
        node.data("directoryFillColor", visual.directoryFillColor);
        node.data("directoryBorderColor", visual.directoryBorderColor);
    });
}

function basename(pathValue = '') {
    const clean = normalizePath(pathValue);
    const parts = clean.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
}

function dirname(pathValue = '') {
    const clean = normalizePath(pathValue);
    if (!clean.includes('/')) return '';
    return clean.slice(0, clean.lastIndexOf('/'));
}

function isDirectoryMoveIntoSelfOrDescendant({ sourcePath, destinationDir }) {
    const src = normalizePath(sourcePath);
    const dest = normalizePath(destinationDir);
    if (!src || !dest) return false;
    return dest === src || dest.startsWith(`${src}/`);
}

function renderedPointInBox(pos, box) {
    if (!pos || !box) return false;
    return pos.x >= box.x1 && pos.x <= box.x2 && pos.y >= box.y1 && pos.y <= box.y2;
}

function findDirectoryAtRenderedPoint(renderedPos, { excludeIds } = {}) {
    if (!cy || !renderedPos) return null;

    let best = null;
    let bestArea = Infinity;
    let bestDepth = -1;

    cy.nodes().forEach((node) => {
        if (!node || node.empty()) return;
        if (node.data('type') !== 'directory') return;
        if (!node.visible()) return;
        if (excludeIds && excludeIds.has(node.id())) return;

        const box = node.renderedBoundingBox({ includeLabels: false });
        if (!renderedPointInBox(renderedPos, box)) return;

        const area = Math.max(1, (box.x2 - box.x1) * (box.y2 - box.y1));
        const id = String(node.id() || '');
        const depth = id === 'Root' ? 0 : id.split('/').filter(Boolean).length;

        // Prefer the smallest bounding box; tie-break toward deeper directories.
        if (area < bestArea || (area === bestArea && depth > bestDepth)) {
            best = node;
            bestArea = area;
            bestDepth = depth;
        }
    });

    return best;
}

function clearDropTargetHighlight() {
    if (!cy || !dragMoveState?.dropTargetId) return;
    const node = cy.getElementById(dragMoveState.dropTargetId);
    if (!node.empty()) node.removeClass('nv-drop-target');
    dragMoveState.dropTargetId = null;
}

function setDropTargetHighlight(node) {
    if (!cy) return;
    const nextId = node?.id?.() || null;
    if (dragMoveState?.dropTargetId === nextId) return;
    clearDropTargetHighlight();
    if (!nextId) return;
    node.addClass('nv-drop-target');
    dragMoveState.dropTargetId = nextId;
}


function collectionContainsNode(collection, targetNode) {
    if (!collection || !targetNode || typeof targetNode.empty !== "function" || targetNode.empty()) return false;
    const targetId = targetNode.id();
    let found = false;
    collection.forEach((node) => {
        if (node?.id?.() === targetId) found = true;
    });
    return found;
}

function isAncestorOfNode(ancestor, node) {
    if (!ancestor || !node || ancestor.empty?.() || node.empty?.()) return false;
    return collectionContainsNode(node.ancestors?.(), ancestor);
}

function isDescendantOfNode(descendant, node) {
    if (!descendant || !node || descendant.empty?.() || node.empty?.()) return false;
    return collectionContainsNode(node.descendants?.(), descendant);
}

function isExpandedDirectoryNode(node) {
    if (!node || typeof node.empty !== "function" || node.empty()) return false;
    if (node.data("type") !== "directory") return false;
    const descendants = typeof node.descendants === "function" ? node.descendants() : null;
    return Boolean(descendants && !descendants.empty());
}

function parentNodeOf(node) {
    const parent = typeof node?.parent === "function" ? node.parent() : null;
    if (!parent || typeof parent.empty !== "function" || parent.empty()) return null;
    return parent;
}

function nodeCollisionBox(node) {
    if (!node || typeof node.boundingBox !== "function") return null;
    try {
        const box = node.boundingBox({ includeLabels: false, includeOverlays: false });
        if (!box || !Number.isFinite(box.x1) || !Number.isFinite(box.x2) || !Number.isFinite(box.y1) || !Number.isFinite(box.y2)) return null;
        return {
            x1: box.x1,
            x2: box.x2,
            y1: box.y1,
            y2: box.y2,
            w: box.x2 - box.x1,
            h: box.y2 - box.y1,
        };
    } catch (_) {
        return null;
    }
}

function paddedBox(box, padding = 0) {
    return {
        x1: box.x1 - padding,
        x2: box.x2 + padding,
        y1: box.y1 - padding,
        y2: box.y2 + padding,
        w: box.w + padding * 2,
        h: box.h + padding * 2,
    };
}

function boxesOverlap(a, b) {
    return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function boxCenter(box) {
    return {
        x: (box.x1 + box.x2) / 2,
        y: (box.y1 + box.y2) / 2,
    };
}

function separationVector(activeBox, targetBox, gap = EXPANDED_DIRECTORY_COLLISION_GAP) {
    const active = paddedBox(activeBox, gap / 2);
    const target = paddedBox(targetBox, gap / 2);
    if (!boxesOverlap(active, target)) return null;

    const activeCenter = boxCenter(active);
    const targetCenter = boxCenter(target);
    const pushRight = targetCenter.x >= activeCenter.x;
    const pushDown = targetCenter.y >= activeCenter.y;
    const shiftX = pushRight ? active.x2 - target.x1 : active.x1 - target.x2;
    const shiftY = pushDown ? active.y2 - target.y1 : active.y1 - target.y2;
    const nudgeX = pushRight ? 0.5 : -0.5;
    const nudgeY = pushDown ? 0.5 : -0.5;

    if (Math.abs(shiftX) <= Math.abs(shiftY)) {
        return { x: shiftX + nudgeX, y: 0 };
    }
    return { x: 0, y: shiftY + nudgeY };
}

function collisionRootForNode(node, movingNode) {
    if (!node || !movingNode || node.empty?.() || movingNode.empty?.()) return null;
    if (!node.visible?.()) return null;
    if (node.id() === movingNode.id()) return null;
    if (isAncestorOfNode(node, movingNode) || isDescendantOfNode(node, movingNode)) return null;

    let root = node;
    while (true) {
        const parent = parentNodeOf(root);
        if (!parent) break;
        if (parent.id() === movingNode.id() || isDescendantOfNode(parent, movingNode)) return null;
        if (isAncestorOfNode(parent, movingNode)) break;
        root = parent;
    }

    if (root.id() === movingNode.id()) return null;
    if (isAncestorOfNode(root, movingNode) || isDescendantOfNode(root, movingNode)) return null;
    return root.visible?.() ? root : null;
}

function collectCollisionRoots(movingNode) {
    const roots = new Map();
    cy.nodes().forEach((node) => {
        const root = collisionRootForNode(node, movingNode);
        if (root) roots.set(root.id(), root);
    });
    roots.delete(movingNode.id());
    return [...roots.values()];
}

function shiftNodeCluster(node, dx, dy) {
    if (!node || node.empty?.() || (!dx && !dy)) return;
    const movableNodes = [];
    const descendants = typeof node.descendants === "function" ? node.descendants() : null;

    if (descendants && !descendants.empty()) {
        descendants.forEach((child) => {
            const children = typeof child.children === "function" ? child.children() : null;
            if (!children || children.empty()) movableNodes.push(child);
        });
    } else {
        movableNodes.push(node);
    }

    movableNodes.forEach((item) => {
        if (typeof item.locked === "function" && item.locked()) return;
        if (typeof item.position !== "function") return;
        const pos = item.position();
        item.position({ x: pos.x + dx, y: pos.y + dy });
    });
}

function resolveExpandedDirectoryCollisions(movingNode, { maxPasses = EXPANDED_DIRECTORY_COLLISION_MAX_PASSES } = {}) {
    if (!cy || !isExpandedDirectoryNode(movingNode)) return;
    const movingId = movingNode.id();

    for (let pass = 0; pass < maxPasses; pass += 1) {
        const activeNode = cy.getElementById(movingId);
        if (!isExpandedDirectoryNode(activeNode)) return;
        const activeBox = nodeCollisionBox(activeNode);
        if (!activeBox) return;

        let movedAny = false;
        collectCollisionRoots(activeNode).forEach((candidate) => {
            const targetBox = nodeCollisionBox(candidate);
            if (!targetBox) return;
            const vector = separationVector(activeBox, targetBox);
            if (!vector) return;
            shiftNodeCluster(candidate, vector.x, vector.y);
            movedAny = true;
        });

        if (!movedAny) break;
    }
}

function scheduleExpandedDirectoryCollisionResolution(node) {
    if (!isExpandedDirectoryNode(node)) return;
    expandedDirectoryCollisionNodeId = node.id();
    if (expandedDirectoryCollisionFrame) return;

    const schedule = typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(callback, 16);

    expandedDirectoryCollisionFrame = schedule(() => {
        const nodeId = expandedDirectoryCollisionNodeId;
        expandedDirectoryCollisionFrame = null;
        expandedDirectoryCollisionNodeId = null;
        if (!cy || !nodeId) return;
        const activeNode = cy.getElementById(nodeId);
        resolveExpandedDirectoryCollisions(activeNode);
    });
}

async function refreshGraphView({ fit = true, reason = 'refresh' } = {}) {
    if (!cy) return;

    // Reset layout bookkeeping.
    if (layoutDebounceTimer) {
        window.clearTimeout(layoutDebounceTimer);
        layoutDebounceTimer = null;
    }
    layoutPendingFit = false;
    layoutPendingReasons.clear();
    layoutHasInitialized = false;
    brokenLinksBySource.clear();
    if (activeLayout && typeof activeLayout.stop === 'function') {
        try { activeLayout.stop(); } catch (_) { /* ignore */ }
        activeLayout = null;
    }

    discoveredLinks.clear();
    linkRecordsBySourceTarget.clear();
    cy.elements().not('.mqtt-live, .td-live').remove();
    externalNodesLoaded = false;

    await loadExternalNodes();

    await hydrateDiscoveredLinksFromBuckets();
    await fetchDirectoryContents(currentRootPath, (data) => {
        renderGraphData(data, currentRootPath);
    }, null, null);

    queueRelayout({ fit: Boolean(fit), reason });
}

window.refreshGraphManager = refreshGraphView;

async function ensureDirectoryChainExpanded(targetDirPath) {
    const cleanTarget = normalizePath(targetDirPath);
    if (!cleanTarget) {
        navigationState.setLastOpenedDirectory("", "GraphManager");
        return;
    }

    const parts = cleanTarget.split('/').filter(Boolean);
    let cumulative = '';
    for (const part of parts) {
        cumulative = cumulative ? `${cumulative}/${part}` : part;
        // Render this directory's children so moved nodes remain reachable in the graph.
        await fetchDirectoryContents(cumulative, (data) => {
            renderGraphData(data, cumulative);
        }, null, null);
    }

    navigationState.setLastOpenedDirectory(cleanTarget, "GraphManager");
}

async function openDirectoryInGraphManager(targetDirectoryPath = "") {
    if (!cy) return false;

    const targetDir = normalizePath(targetDirectoryPath || "");
    const cleanRoot = normalizePath(currentRootPath || "");

    if (!targetDir && cleanRoot) {
        currentRootPath = "";
        await refreshGraphView({ fit: true, reason: "open-directory-root-reset" });
    } else if (targetDir && cleanRoot && targetDir !== cleanRoot && !targetDir.startsWith(`${cleanRoot}/`)) {
        currentRootPath = targetDir;
        await refreshGraphView({ fit: true, reason: "open-directory-root-switch" });
    } else if (targetDir) {
        await ensureDirectoryChainExpanded(targetDir);
        queueRelayout({ fit: true, reason: "open-directory-expand" });
    }

    navigationState.setLastOpenedDirectory(targetDir, "GraphManager");

    const targetNodeId = targetDir || normalizePath(currentRootPath || "") || "Root";
    const targetNode = cy.getElementById(targetNodeId);
    if (targetNode && !targetNode.empty()) {
        try { cy.center(targetNode); } catch (_) { /* ignore */ }
    }
    return true;
}

async function revealPathInGraphManager(path, options = {}) {
    const cleanPath = normalizePath(path || "");
    if (!cleanPath) return false;

    const isDirectory = Boolean(options?.isDirectory);
    const targetDir = isDirectory ? cleanPath : dirname(cleanPath);
    await openDirectoryInGraphManager(targetDir);

    const node = cy?.getElementById(cleanPath);
    if (node && !node.empty()) {
        try { cy.center(node); } catch (_) { /* ignore */ }
    }

    if (!isDirectory) {
        requestNodevisionFileSelection(cleanPath);
    }

    return true;
}

window.openDirectoryInGraphManager = openDirectoryInGraphManager;
window.revealPathInGraphManager = revealPathInGraphManager;

function setupCtrlDragMoveHandlers() {
    if (!cy) return;
    dragMoveState = {
        active: false,
        sourceId: null,
        sourcePath: null,
        sourceType: null,
        sourceParentId: null,
        sourcePosition: null,
        dropTargetId: null,
    };

    cy.on('grab', 'node', (evt) => {
        const original = evt?.originalEvent;
        const moveKey = Boolean(original?.ctrlKey || original?.metaKey);
        if (!moveKey) return;

        const node = evt.target;
        if (!node || node.empty()) return;

        const type = node.data('type');
        if (type !== 'file' && type !== 'directory') return;

        const fullPath = normalizePath(node.data('fullPath') ?? '');
        if (!fullPath) return; // do not move Root / empty

        dragMoveState.active = true;
        dragMoveState.sourceId = node.id();
        dragMoveState.sourcePath = fullPath;
        dragMoveState.sourceType = type;
        const parent = typeof node.parent === 'function' ? node.parent() : null;
        dragMoveState.sourceParentId = parent && typeof parent.id === 'function' ? parent.id() : null;
        dragMoveState.sourcePosition = typeof node.position === 'function'
            ? { ...node.position() }
            : null;

        cy.batch(() => {
            node.addClass('nv-move-source');
            // When ctrl/meta is held, the user is intending to *remove* the node from its current compound
            // directory. Detach immediately so the source compound doesn't keep resizing while dragging.
            if (dragMoveState.sourceParentId && typeof node.move === 'function') {
                try {
                    node.move({ parent: null });
                } catch (_) {
                    // Fallback: attempt to clear parent data (older Cytoscape builds/plugins).
                    try { node.data('parent', null); } catch (_) { /* ignore */ }
                }
            }
        });
    });

    cy.on('drag', 'node', (evt) => {
        if (!dragMoveState?.active) return;
        const node = evt.target;
        if (!node || node.empty()) return;
        if (node.id() !== dragMoveState.sourceId) return;

        const renderedPos = typeof node.renderedPosition === 'function'
            ? node.renderedPosition()
            : evt?.renderedPosition;

        const excludeIds = new Set();
        if (dragMoveState.sourceParentId) excludeIds.add(dragMoveState.sourceParentId);
        if (dragMoveState.sourceType === 'directory' && dragMoveState.sourceId) excludeIds.add(dragMoveState.sourceId);

        const targetDir = findDirectoryAtRenderedPoint(renderedPos, { excludeIds });
        if (!targetDir || targetDir.empty()) {
            // Allow dropping onto the graph root by releasing over empty canvas.
            const sourceParent = dirname(dragMoveState.sourcePath || '');
            if (sourceParent) {
                const rootId = normalizePath(currentRootPath) || 'Root';
                const rootNode = cy.getElementById(rootId);
                if (!rootNode.empty()) {
                    setDropTargetHighlight(rootNode);
                    return;
                }
            }

            setDropTargetHighlight(null);
            return;
        }

        // Avoid suggesting moving into itself/descendant.
        const destinationDir = normalizePath(targetDir.data('fullPath') ?? '');
        if (dragMoveState.sourceType === 'directory') {
            if (isDirectoryMoveIntoSelfOrDescendant({ sourcePath: dragMoveState.sourcePath, destinationDir })) {
                setDropTargetHighlight(null);
                return;
            }
        }

        // If dropping onto the current parent directory, allow but don't emphasize.
        setDropTargetHighlight(targetDir);
    });

    cy.on('free', 'node', async (evt) => {
        const node = evt.target;
        if (!dragMoveState?.active) return;
        if (!node || node.empty()) return;
        if (node.id() !== dragMoveState.sourceId) return;

        node.removeClass('nv-move-source');
        const sourcePath = dragMoveState.sourcePath;
        const sourceType = dragMoveState.sourceType;
        const dropTargetId = dragMoveState.dropTargetId;
        const sourceParentId = dragMoveState.sourceParentId;
        const sourcePosition = dragMoveState.sourcePosition;

        dragMoveState.active = false;
        dragMoveState.sourceId = null;
        dragMoveState.sourcePath = null;
        dragMoveState.sourceType = null;
        dragMoveState.sourceParentId = null;
        dragMoveState.sourcePosition = null;
        clearDropTargetHighlight();

        if (!sourcePath) return;
        if (!dropTargetId) {
            // Cancelled move: restore the original compound parent + position.
            try {
                if (sourceParentId && typeof node.move === 'function') node.move({ parent: sourceParentId });
                if (sourcePosition && typeof node.position === 'function') node.position(sourcePosition);
            } catch (_) { /* ignore */ }
            return;
        }

        const targetNode = cy.getElementById(dropTargetId);
        if (!targetNode || targetNode.empty()) {
            try {
                if (sourceParentId && typeof node.move === 'function') node.move({ parent: sourceParentId });
                if (sourcePosition && typeof node.position === 'function') node.position(sourcePosition);
            } catch (_) { /* ignore */ }
            return;
        }

        const destinationDir = normalizePath(targetNode.data('fullPath') ?? '');
        const destinationPath = destinationDir ? `${destinationDir}/${basename(sourcePath)}` : basename(sourcePath);
        if (!destinationPath || destinationPath === sourcePath) {
            try {
                if (sourceParentId && typeof node.move === 'function') node.move({ parent: sourceParentId });
                if (sourcePosition && typeof node.position === 'function') node.position(sourcePosition);
            } catch (_) { /* ignore */ }
            return;
        }

        if (sourceType === 'directory' && isDirectoryMoveIntoSelfOrDescendant({ sourcePath, destinationDir })) {
            alert("Cannot move a folder into itself (or one of its subfolders).");
            try {
                if (sourceParentId && typeof node.move === 'function') node.move({ parent: sourceParentId });
                if (sourcePosition && typeof node.position === 'function') node.position(sourcePosition);
            } catch (_) { /* ignore */ }
            return;
        }

        try {
            await moveFileOrDirectory(sourcePath, destinationDir);
        } catch (err) {
            console.error('[GraphManager] Move failed:', err);
            alert(`Move failed: ${err?.message || err}`);
            try {
                if (sourceParentId && typeof node.move === 'function') node.move({ parent: sourceParentId });
                if (sourcePosition && typeof node.position === 'function') node.position(sourcePosition);
            } catch (_) { /* ignore */ }
            return;
        }

        // Link/graph impact callout for files (same behavior as File Manager).
        if (sourceType === 'file') {
            try {
                await maybePromptLinkMoveImpact({ oldPath: sourcePath, newPath: destinationPath });
            } catch (err) {
                console.warn('[GraphManager] Link impact prompt failed:', err);
            }
        }

        // Refresh the graph so the moved node appears in the right place.
        try {
            await refreshGraphView({ fit: true, reason: 'move' });
            if (destinationDir) {
                await ensureDirectoryChainExpanded(destinationDir);
            }
        } catch (err) {
            console.warn('[GraphManager] Refresh after move failed:', err);
        }

        // Also refresh File Manager if present.
        if (typeof window.refreshFileManager === 'function') {
            try { await window.refreshFileManager(window.currentDirectoryPath || ''); } catch (_) { /* ignore */ }
        } else {
            document.dispatchEvent(new CustomEvent('refreshFileManager'));
        }
    });
}

function edgeRecordKey(sourcePath, targetPath) {
    return normalizePath(sourcePath) + "->" + normalizePath(targetPath);
}

function rememberLink(sourcePath, targetPath, record = null) {
    const source = normalizePath(sourcePath);
    const target = normalizePath(targetPath);
    if (!source || !target) return;

    let targets = discoveredLinks.get(source);
    if (!targets) {
        targets = new Set();
        discoveredLinks.set(source, targets);
    }
    targets.add(target);

    if (record && typeof record === "object") {
        const key = edgeRecordKey(source, target);
        const records = linkRecordsBySourceTarget.get(key) || [];
        const duplicate = records.some((item) => item.id === record.id);
        if (!duplicate) records.push(record);
        linkRecordsBySourceTarget.set(key, records);
    }
}

function clearLinkRecordsForSource(sourcePath) {
    const source = normalizePath(sourcePath);
    if (!source) return;
    for (const key of [...linkRecordsBySourceTarget.keys()]) {
        if (key.startsWith(source + "->")) linkRecordsBySourceTarget.delete(key);
    }
    discoveredLinks.delete(source);
}


function makePersistedLinkRecord(edge) {
    if (!edge || typeof edge !== "object") return null;
    const hasMetadata = Boolean(
        edge.linkKind ||
        edge.linkProperty ||
        edge.linkText ||
        edge.displayText ||
        edge.edgeLabel ||
        (Array.isArray(edge.tags) && edge.tags.length) ||
        (Array.isArray(edge.symbols) && edge.symbols.length)
    );
    if (!hasMetadata) return null;
    const target = normalizePath(edge.target || "");
    const record = {
        id: "persisted:" + normalizePath(edge.source || "") + "->" + target,
        recordIndex: 0,
        sourcePath: normalizePath(edge.source || ""),
        sourceFormat: "persisted",
        linkKind: edge.linkKind || "link",
        linkProperty: edge.linkProperty || "",
        targetRaw: target,
        targetKind: target.startsWith("external:") ? "external" : "internal",
        targetPath: target,
        linkText: edge.linkText || "",
        tags: Array.isArray(edge.tags) ? edge.tags : [],
        symbols: Array.isArray(edge.symbols) ? edge.symbols : [],
        displayText: edge.displayText || "",
        edgeLabel: edge.edgeLabel || "",
        editableTarget: false,
        editableText: false,
        editableMetadata: false,
        ranges: {}
    };
    record.edgeLabel = record.edgeLabel || makeEdgeLabel(record);
    return record;
}

function ingestPersistedEdgeData(data) {
    if (!data) return;

    // Current bucket format: [{ source, target }, ...]
    if (Array.isArray(data)) {
        for (const edge of data) {
            if (edge && typeof edge === 'object') {
                rememberLink(edge.source, edge.target, makePersistedLinkRecord(edge));
            }
        }
        return;
    }

    // Backward compatibility with keyed object formats.
    if (typeof data === 'object') {
        for (const [source, rec] of Object.entries(data)) {
            if (!rec || typeof rec !== 'object') continue;
            const outgoing = rec.edgesFrom || rec.sources || [];
            if (Array.isArray(outgoing)) {
                for (const target of outgoing) {
                    rememberLink(source, target);
                }
            }
        }
    }
}

async function hydrateDiscoveredLinksFromBuckets() {
    const fetches = EDGE_BUCKET_SYMBOLS.map(async (symbol) => {
        const bucket = `${encodeURIComponent(symbol)}.json`;
        const url = `/public/data/edges/${bucket}`;
        try {
            const res = await fetch(url);
            if (!res.ok) return;
            const text = await res.text();
            if (!text.trim()) return;
            const json = JSON.parse(text);
            ingestPersistedEdgeData(json);
        } catch (err) {
            console.warn(`[GraphManager] Failed to hydrate bucket ${bucket}:`, err);
        }
    });

    await Promise.all(fetches);
}

function isExpandedDirectory(nodeId) {
    const node = cy.getElementById(nodeId);
    if (node.empty()) return false;
    if (node.data('type') !== 'directory') return false;
    return !node.descendants().empty();
}

function resolveVisibleTargetNode(targetPath) {
    // If the target is an external node, anchor directly to it.
    if (cy && !cy.getElementById(targetPath).empty()) {
        return targetPath;
    }

    const visibleTarget = getVisibleNodeId(cy, targetPath);
    if (!visibleTarget) return null;

    // Never anchor an edge on an expanded directory.
    // Prefer the closest visible descendant along targetPath.
    if (!isExpandedDirectory(visibleTarget)) return visibleTarget;
    const cleanTarget = normalizePath(targetPath);
    const prefix = `${visibleTarget}/`;
    if (!cleanTarget.startsWith(prefix)) return null;

    const parts = cleanTarget.split('/');
    for (let i = parts.length; i > 0; i--) {
        const candidate = parts.slice(0, i).join('/');
        const node = cy.getElementById(candidate);
        if (!node.empty()) {
            if (node.data('type') !== 'directory' || node.descendants().empty()) {
                return candidate;
            }
        }
    }

    return null;
}

function edgeLabelFromRecords(records = []) {
    return [...new Set(records.map((record) => makeEdgeLabel(record)).filter(Boolean))].join(" | ");
}

function rebuildVisibleEdges() {
    if (!cy) return;

    const edgeMap = new Map();
    for (const [sourcePath, targets] of discoveredLinks.entries()) {
        const visibleSource = getVisibleNodeId(cy, sourcePath);
        if (!visibleSource) continue;

        for (const targetPath of targets) {
            const visibleTarget = resolveVisibleTargetNode(targetPath);
            if (!visibleTarget) continue;
            if (visibleSource === visibleTarget) continue;

            const key = visibleSource + "->" + visibleTarget;
            const records = [...(linkRecordsBySourceTarget.get(edgeRecordKey(sourcePath, targetPath)) || [])];
            const existing = edgeMap.get(key);
            if (existing) {
                existing.data.linkRecords.push(...records);
                existing.data.occurrenceCount = existing.data.linkRecords.length;
                existing.data.edgeLabel = edgeLabelFromRecords(existing.data.linkRecords);
                continue;
            }

            const edgeLabel = edgeLabelFromRecords(records);
            const primary = records[0] || null;
            edgeMap.set(key, {
                group: "edges",
                data: {
                    id: "edge-" + visibleSource + "-" + visibleTarget,
                    source: visibleSource,
                    target: visibleTarget,
                    sourcePath,
                    targetPath,
                    linkRecords: records,
                    occurrenceCount: records.length,
                    edgeLabel,
                    linkKind: primary?.linkKind || "link",
                    linkProperty: primary?.linkProperty || "",
                    linkText: primary?.linkText || "",
                    targetKind: primary?.targetKind || (String(targetPath).startsWith("external:") ? "external" : "internal"),
                    tags: primary?.tags || [],
                    symbols: primary?.symbols || [],
                    displayText: primary?.displayText || ""
                }
            });
        }
    }

    cy.batch(() => {
        cy.edges().not(".mqtt-live, .td-live").remove();
        if (edgeMap.size > 0) {
            cy.add([...edgeMap.values()]);
        }
    });
}


function buildGraphLayoutOptions({ fit = true } = {}) {
    // Use fcose for better compound-node packing and reduced wasted space.
    // First run uses random initialization for fast, non-overlapping placement.
    // Subsequent runs use proof quality + deterministic initialization (randomize: false)
    // so relayouts (expand/collapse) are stable and labels are considered.
    const proof = layoutHasInitialized === true;
    const hasFcose = typeof cytoscape === 'function' && !!cytoscape('layout', 'fcose');
    if (!hasFcose) {
        // Fallback (should be rare): keep cose but still disable animation and fit.
        return {
            name: 'cose',
            fit: Boolean(fit),
            padding: 14,
            animate: false,
        };
    }

    return {
        name: 'fcose',
        fit: Boolean(fit),
        padding: 14,
        animate: false,
        quality: proof ? 'proof' : 'default',
        randomize: proof ? false : true,
        nodeDimensionsIncludeLabels: proof ? true : false,
        packComponents: true,
        tile: true,
        tilingPaddingVertical: 12,
        tilingPaddingHorizontal: 12,

        // Compact but readable spacing.
        nodeSeparation: 40,
        idealEdgeLength: () => 80,
        nodeRepulsion: () => 4200,
        edgeElasticity: () => 0.35,
        nestingFactor: 0.45,

        // Pull components together to minimize empty space; keep compounds readable.
        gravity: 0.55,
        gravityCompound: 1.2,
        gravityRangeCompound: 1.25,
        gravityRange: 2.2,

        // Reasonable iteration cap for medium graphs.
        numIter: proof ? 1600 : 1000,
    };
}

function queueRelayout({ fit = true, reason = 'update' } = {}) {
    if (!cy) return;
    layoutPendingFit = layoutPendingFit || Boolean(fit);
    if (reason) layoutPendingReasons.add(String(reason));
    if (layoutDebounceTimer) return;

    layoutDebounceTimer = window.setTimeout(() => {
        layoutDebounceTimer = null;
        const doFit = layoutPendingFit;
        const reasons = [...layoutPendingReasons.values()];
        layoutPendingFit = false;
        layoutPendingReasons.clear();
        runRelayout({ fit: doFit, reasons });
    }, 60);
}

function runRelayout({ fit = true, reasons = [] } = {}) {
    if (!cy) return;
    try {
        cy.resize();
    } catch (_) {
        // ignore
    }

    if (activeLayout && typeof activeLayout.stop === 'function') {
        try { activeLayout.stop(); } catch (_) { /* ignore */ }
    }

    const opts = buildGraphLayoutOptions({ fit });
    if (reasons.length > 0) {
        console.debug('[GraphManager] relayout', reasons.join(', '), opts.quality, opts.randomize ? '(random)' : '(stable)');
    }

    activeLayout = cy.layout(opts);
    activeLayout.one('layoutstop', () => {
        layoutHasInitialized = true;
        if (fit) {
            try { cy.fit(undefined, opts.padding || 14); } catch (_) { /* ignore */ }
        }
        activeLayout = null;
    });
    activeLayout.run();
}

async function notebookAssetExists(relativePath) {
    if (!relativePath) return false;
    const url = toNotebookAssetUrl(relativePath);
    try {
        const headRes = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        if (headRes.ok) return true;
        // Some servers may not support HEAD; fall back to GET without reading body.
        if (headRes.status === 405 || headRes.status === 501) {
            const getRes = await fetch(url, { method: 'GET', cache: 'no-store' });
            return getRes.ok;
        }
        return false;
    } catch (_) {
        return false;
    }
}

function rememberBrokenLink(sourcePath, targetPath) {
    const source = normalizePath(sourcePath);
    const target = normalizePath(targetPath);
    if (!source || !target) return;

    let targets = brokenLinksBySource.get(source);
    if (!targets) {
        targets = new Set();
        brokenLinksBySource.set(source, targets);
    }
    targets.add(target);
}

function clearBrokenLinksForSource(sourcePath) {
    const source = normalizePath(sourcePath);
    if (!source) return;
    brokenLinksBySource.delete(source);
    const node = cy?.getElementById(source);
    if (node && !node.empty()) {
        node.data('brokenLinkCount', 0);
        node.data('hasBrokenLinks', 0);
    }
}

function applyBrokenLinkBadge(sourcePath) {
    const source = normalizePath(sourcePath);
    if (!source) return;
    const node = cy?.getElementById(source);
    if (!node || node.empty()) return;
    const brokenSet = brokenLinksBySource.get(source);
    const count = brokenSet ? brokenSet.size : 0;
    node.data('brokenLinkCount', count);
    node.data('hasBrokenLinks', count > 0 ? 1 : 0);
}


function escapeHtml(value = "") {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function openGraphLinkPanel(panelName, displayName, offsetX = 0) {
    const existing = document.querySelector(".panel[data-instance-name=\"" + panelName + "\"], [data-id=\"" + panelName + "\"]");
    if (existing) {
        existing.style.display = "flex";
        existing.style.zIndex = "23000";
        if (typeof window.highlightActiveCell === "function") {
            const cell = existing.closest(".panel-cell");
            if (cell) window.highlightActiveCell(cell);
        }
        if (panelName === "LinkViewer" && typeof window.updateLinkViewerPanel === "function") {
            window.updateLinkViewerPanel(window.selectedGraphLink || null);
        }
        if (panelName === "LinkEditor" && typeof window.updateLinkEditorPanel === "function") {
            window.updateLinkEditorPanel(window.selectedGraphLink || null);
        }
        return existing;
    }

    const { createPanelDOM } = await import("/panels/panelFactory.mjs");
    const panelInst = await createPanelDOM(
        panelName,
        "nv-" + panelName.toLowerCase() + "-" + Date.now(),
        "InfoPanel",
        { displayName, layout: "floating" }
    );
    document.body.appendChild(panelInst.panel);
    if (typeof panelInst.panel.__nvSetLayout === "function") {
        panelInst.panel.__nvSetLayout("floating");
    }
    Object.assign(panelInst.panel.style, {
        width: "min(460px, 92vw)",
        height: "min(560px, 82vh)",
        left: Math.max(24, Math.round(window.innerWidth * 0.52) + offsetX) + "px",
        top: Math.max(28, Math.round(window.innerHeight * 0.12)) + "px",
        zIndex: "23000",
    });
    return panelInst.panel;
}

window.openLinkViewerPanel = () => openGraphLinkPanel("LinkViewer", "Link Viewer", 0);
window.openLinkEditorPanel = () => openGraphLinkPanel("LinkEditor", "Link Editor", 36);

function renderGraphLinkInspector(selection) {
    if (!linkInspectorElem) return;
    const record = selection?.record || null;
    if (!record) {
        linkInspectorElem.style.display = "none";
        linkInspectorElem.innerHTML = "";
        return;
    }

    linkInspectorElem.style.display = "block";
    const countText = selection.occurrenceCount > 1 ? " (" + selection.occurrenceCount + " links)" : "";
    const targetLabel = record.targetKind === "external" ? record.targetRaw : record.targetPath;
    linkInspectorElem.innerHTML = "<div style=\"font-weight:700;margin-bottom:4px;\">" + escapeHtml(summarizeLinkRecord(record)) + escapeHtml(countText) + "</div>" +
        "<div style=\"color:#475569;margin-bottom:6px;\">" + escapeHtml(record.sourcePath) + " -> " + escapeHtml(targetLabel) + "</div>" +
        "<div style=\"display:flex;gap:6px;flex-wrap:wrap;\">" +
        "<button type=\"button\" data-link-panel=\"viewer\" style=\"font:inherit;padding:4px 7px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;\">Link Viewer</button>" +
        "<button type=\"button\" data-link-panel=\"editor\" style=\"font:inherit;padding:4px 7px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;\">Link Editor</button>" +
        "</div>";

    const viewerBtn = linkInspectorElem.querySelector("[data-link-panel=\"viewer\"]");
    const editorBtn = linkInspectorElem.querySelector("[data-link-panel=\"editor\"]");
    viewerBtn?.addEventListener("click", () => window.openLinkViewerPanel?.());
    editorBtn?.addEventListener("click", () => window.openLinkEditorPanel?.());
}

function bindGraphManagerLayerControls(container) {
    const controlsEl = container || null;
    mqttGraphLayer?.setControlsElement?.(controlsEl);
    tdGraphLayer?.setControlsElement?.(controlsEl);
}

if (typeof window !== "undefined") {
    window.bindGraphManagerLayerControls = bindGraphManagerLayerControls;
}

export async function initGraphView({ containerId, rootPath, statusElemId, mqttControlsId = null, mqttInspectorId = null, linkInspectorId = null }) {
    currentRootPath = normalizePath(rootPath);
    navigationState.setLastOpenedDirectory(currentRootPath, "GraphManager");
    discoveredLinks.clear();
    linkRecordsBySourceTarget.clear();
    linkInspectorElem = linkInspectorId ? document.getElementById(linkInspectorId) : null;
    renderGraphLinkInspector(null);
    const container = document.getElementById(containerId);
    const statusElem = statusElemId ? document.getElementById(statusElemId) : null;
    const edgeStyleOverrides = await loadEdgeStyleOverrides();

    cy = cytoscape({
        container: container,
        boxSelectionEnabled: false,
        selectionType: 'single',
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'color': '#333',
                    'background-color': '#0078d7',
                    'font-size': '10px',
                    'text-wrap': 'wrap',
                    'text-max-width': 110,
                    'z-index': 10
                }
            },
            {
                selector: 'node[type="directory"]',
                style: {
                    'background-color': 'data(directoryColor)',
                    'shape': 'round-rectangle',
                    // Keep unexpanded directories compact while allowing expanded ones
                    // to size naturally around their children.
                    'min-width': 64,
                    'min-height': 64,
                    'border-width': 1,
                    'border-color': 'data(directoryBorderColor)'
                }
            },
            {
                selector: 'node[type="directory"]:childless',
                style: {
                    'width': 64,
                    'height': 64
                }
            },
            {
                selector: 'node[type="directory"][hasDirectoryImage = 1]',
                style: {
                    'background-image': 'data(directoryImageUrl)',
                    'background-fit': 'contain',
                    'background-position-x': '50%',
                    'background-position-y': '50%',
                    'background-repeat': 'no-repeat',
                    'background-opacity': 1,
                    'border-width': 1,
                    'border-color': 'data(directoryBorderColor)'
                }
            },
            {
                selector: ':parent',
                style: {
                    'background-opacity': 1,
                    'background-color': 'data(directoryFillColor)',
                    'border-color': 'data(directoryColor)',
                    'border-width': 3,
                    'text-valign': 'top',
                    'text-halign': 'center',
                    // Keep expanded directories visually nested instead of flush with the parent border.
                    'padding': EXPANDED_DIRECTORY_PARENT_MARGIN,
                    'text-margin-y': 4,
                    'compound-sizing-wrt-labels': 'include'
                }
            },
            {
                // Ensure directory preview stays visible even when it has children (compound node).
                selector: 'node[type="directory"][hasDirectoryImage = 1]:parent',
                style: {
                    'background-image': 'data(directoryImageUrl)',
                    'background-fit': 'contain',
                    'background-position-x': '50%',
                    'background-position-y': '50%',
                    'background-repeat': 'no-repeat',
                    'background-opacity': 1,
                    'background-image-opacity': 0.75
                }
            },
            {
                selector: 'node[type="directory"].nv-drop-target',
                style: {
                    'background-color': '#ffe79a',
                    'background-opacity': 0.32,
                    'border-color': '#fff1bf',
                    'border-width': 3
                }
            },
            {
                selector: 'node.nv-move-source',
                style: {
                    'border-color': '#0a84ff',
                    'border-width': 3,
                    'overlay-color': '#0a84ff',
                    'overlay-opacity': 0.08
                }
            },
            {
                selector: 'node[type="external"]',
                style: {
                    'shape': 'diamond',
                    'width': 80,
                    'height': 80,
                    'background-color': '#4dd0e1',
                    'border-color': '#00838f',
                    'border-width': 2,
                    'label': 'data(label)',
                    'color': '#0b1021',
                    'font-weight': 'bold',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'text-outline-width': 2,
                    'text-outline-color': '#e0f7fa'
                }
            },
            {
                selector: 'node[type="file"]',
                style: {
                    'width': 72,
                    'height': 72,
                    'shape': 'ellipse',
                    'background-color': '#e1e7ef',
                    'border-width': 1,
                    'border-color': '#9aa7b8',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 6,
                    'padding': 4
                }
            },
            {
                selector: 'node[type="file"][hasPreview = 1]',
                style: {
                    'background-image': 'data(previewUrl)',
                    'background-fit': 'cover',
                    'background-position-x': '50%',
                    'background-position-y': '50%',
                    'background-repeat': 'no-repeat',
                    'background-opacity': 1,
                    'border-color': '#5a708c'
                }
            },
            {
                selector: 'node[type="file"][hasBrokenLinks = 1]',
                style: {
                    'border-color': '#d32f2f',
                    'border-width': 3,
                    'background-color': '#ffeaea',
                    'shadow-blur': 12,
                    'shadow-color': '#d32f2f',
                    'shadow-opacity': 0.75,
                    'shadow-offset-x': 0,
                    'shadow-offset-y': 0,
                    // Overlay warning badge without losing file preview/background.
                    'background-image': ['data(previewUrl)', BROKEN_LINK_BADGE_URL],
                    'background-fit': ['cover', 'contain'],
                    'background-clip': ['node', 'none'],
                    'background-repeat': ['no-repeat', 'no-repeat'],
                    'background-position-x': ['50%', '90%'],
                    'background-position-y': ['50%', '10%'],
                    'background-width': ['100%', '18px'],
                    'background-height': ['100%', '18px']
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#adadad',
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': '#adadad',
                    'curve-style': 'unbundled-bezier',
                    'control-point-distances': [20, -20],
                    'control-point-weights': [0.25, 0.75],
                    'opacity': 0.8,
                    'arrow-scale': 1.2,
                    'label': 'data(edgeLabel)',
                    'font-size': 10,
                    'font-weight': 600,
                    'color': '#253045',
                    'text-rotation': 'autorotate',
                    'text-background-color': '#ffffff',
                    'text-background-opacity': 0.86,
                    'text-background-padding': 2,
                    'text-margin-y': -8,
                    ...(edgeStyleOverrides || {})
                }
            },
            {
                selector: 'edge.nv-selected-link',
                style: {
                    'width': 4,
                    'line-color': '#2563eb',
                    'target-arrow-color': '#2563eb',
                    'opacity': 1,
                    'z-index': 30
                }
            },
            ...MQTT_GRAPH_STYLE,
            ...THING_DESCRIPTION_GRAPH_STYLE
        ],
        layout: { name: 'preset' }
    });

    window.cy = cy;

    // Keep Cytoscape's renderer in sync with available panel space.
    if (container && typeof ResizeObserver !== 'undefined') {
        try {
            if (container.__nvGraphResizeObserver) {
                container.__nvGraphResizeObserver.disconnect();
            }
            const ro = new ResizeObserver(() => {
                if (!cy) return;
                try { cy.resize(); } catch (_) { /* ignore */ }
                if (!activeLayout) {
                    try { cy.fit(undefined, 14); } catch (_) { /* ignore */ }
                }
            });
            ro.observe(container);
            container.__nvGraphResizeObserver = ro;
        } catch (err) {
            console.warn('[GraphManager] ResizeObserver setup failed:', err);
        }
    }

    cy.on('tap', 'node', (evt) => {
        const path = evt.target.data('fullPath');
        if (path !== undefined) requestNodevisionFileSelection(path);
        if (evt.target.data('type') === 'external' && evt.target.data('url')) {
            window.selectedExternalUrl = evt.target.data('url');
        }
    });

    cy.on("tap", "edge", (evt) => {
        const edge = evt.target;
        cy.edges().removeClass("nv-selected-link");
        edge.addClass("nv-selected-link");
        const selection = buildSelectedGraphLink(edge.data(), 0);
        setSelectedGraphLink(selection);
        renderGraphLinkInspector(selection);
    });

    cy.on("tap", (evt) => {
        if (evt.target !== cy) return;
        cy.edges().removeClass("nv-selected-link");
        setSelectedGraphLink(null);
        renderGraphLinkInspector(null);
    });

    cy.on('dblclick', 'node', async (evt) => {
        const node = evt.target;
        if (node.data('type') === 'directory') {
            await toggleCompoundDirectory(node);
            navigationState.setLastOpenedDirectory(node.data('fullPath') || "", "GraphManager");
        }
    });


    cy.on("drag", "node[type=\"directory\"]", (evt) => {
        if (dragMoveState?.active) return;
        scheduleExpandedDirectoryCollisionResolution(evt.target);
    });

    cy.on("free", "node[type=\"directory\"]", (evt) => {
        if (dragMoveState?.active) return;
        resolveExpandedDirectoryCollisions(evt.target);
    });

    setupCtrlDragMoveHandlers();

    mqttGraphLayer?.cleanup?.();
    tdGraphLayer?.cleanup?.();

    const layerControlsEl = mqttControlsId ? document.getElementById(mqttControlsId) : null;
    mqttGraphLayer = attachMqttGraphLayer({
        cy,
        controlsEl: layerControlsEl,
        inspectorEl: mqttInspectorId ? document.getElementById(mqttInspectorId) : null,
        relayout: queueRelayout,
    });

    tdGraphLayer = attachThingDescriptionGraphLayer({
        cy,
        controlsEl: layerControlsEl,
        relayout: queueRelayout,
    });
    bindGraphManagerLayerControls(document.querySelector("[data-graph-manager-layer-controls]"));
    window.dispatchEvent(new CustomEvent("graphManagerLayersReady"));

    await loadExternalNodes();

    if (statusElem) statusElem.textContent = "Fetching Files...";
    await hydrateDiscoveredLinksFromBuckets();
    await fetchDirectoryContents(currentRootPath, (data) => {
        renderGraphData(data, currentRootPath);
        if (statusElem) statusElem.textContent = "Ready";
    }, null, null);
}

async function renderGraphData(files, parentPath) {
    if (!files) return;

    const normalizedParentPath = normalizePath(parentPath);
    const parentId = normalizedParentPath || "Root";
    const currentDirectoryImage = inferCurrentDirectoryImage(files, normalizedParentPath);
    const previewFetches = [];

    if (cy.getElementById(parentId).empty()) {
        cy.add({
            group: 'nodes',
            data: { 
                id: parentId, 
                label: parentId === "Root" ? "🏠 Notebook" : parentId.split('/').pop(), 
                type: 'directory', 
                fullPath: normalizedParentPath,
                directoryImageUrl: currentDirectoryImage,
                hasDirectoryImage: currentDirectoryImage ? 1 : 0,
                ...directoryVisualData(normalizedParentPath)
            }
        });
    } else {
        const parentNode = cy.getElementById(parentId);
        parentNode.data('directoryImageUrl', currentDirectoryImage);
        parentNode.data('hasDirectoryImage', currentDirectoryImage ? 1 : 0);
    }

    const filesToScan = [];

    cy.batch(() => {
        files.forEach(f => {
            const rawPath = parentPath ? `${parentPath}/${f.name}` : f.name;
            const fullPath = normalizePath(rawPath);
            const directoryImageUrl = f.isDirectory && typeof f.directoryImageUrl === 'string' ? f.directoryImageUrl : '';
            let previewUrl = '';
            let hasPreview = 0;
            if (!f.isDirectory) {
                const ext = f.name.split('.').pop().toLowerCase();
                if (ext === 'svg' || ext === 'png') {
                    previewUrl = toNotebookAssetUrl(fullPath);
                    hasPreview = 1;
                } else if (ext === 'html') {
                    previewFetches.push({ id: fullPath, path: fullPath });
                }
            }
            
                if (cy.getElementById(fullPath).empty()) {
                    cy.add({
                        group: 'nodes',
                        data: {
                            id: fullPath,
                            label: f.name,
                            fullPath: fullPath,
                            type: f.isDirectory ? 'directory' : 'file',
                            parent: parentId,
                            directoryImageUrl,
                            hasDirectoryImage: directoryImageUrl ? 1 : 0,
                            ...(f.isDirectory ? directoryVisualData(fullPath) : {}),
                            previewUrl,
                            hasPreview,
                            hasBrokenLinks: 0,
                            brokenLinkCount: 0
                        }
                    });
                } else if (f.isDirectory) {
                    const existing = cy.getElementById(fullPath);
                    existing.data('directoryImageUrl', directoryImageUrl);
                existing.data('hasDirectoryImage', directoryImageUrl ? 1 : 0);
            } else {
                const existing = cy.getElementById(fullPath);
                if (!existing.empty()) {
                    existing.data('previewUrl', previewUrl);
                    existing.data('hasPreview', hasPreview);
                    existing.data('hasBrokenLinks', 0);
                    existing.data('brokenLinkCount', 0);
                }
            }

            if (!f.isDirectory) {
                const ext = f.name.split('.').pop().toLowerCase();
                if (["html", "htm", "xhtml", "php", "md", "markdown"].includes(ext)) {
                    filesToScan.push(fullPath);
                }
            }
        });
    });

    updateDirectoryLevelColors();

    // Give newly added nodes a reasonable placement quickly.
    queueRelayout({ fit: false, reason: 'nodes-added' });

    // Scan for links AFTER nodes are added to the graph instance
    for (const filePath of filesToScan) {
        await handleLinkDiscovery(filePath);
    }

    for (const task of previewFetches) {
        const url = await findFirstImageInHtml(task.path);
        if (url) {
            const node = cy.getElementById(task.id);
            if (!node.empty()) {
                node.data('previewUrl', url);
                node.data('hasPreview', 1);
            }
        }
    }

    rebuildVisibleEdges();
    tdGraphLayer?.refresh?.();
    // Final relayout after edges exist so connected structures pack better.
    queueRelayout({ fit: true, reason: 'edges-updated' });
}

async function handleLinkDiscovery(filePath) {
    const cleanSource = normalizePath(filePath);
    clearBrokenLinksForSource(cleanSource);
    clearLinkRecordsForSource(cleanSource);
    try {
        const records = await scanFileForLinkRecords(cleanSource);

        if (records && Array.isArray(records)) {
            for (const record of records) {
                const rawTarget = record.targetRaw;
                if (!rawTarget) continue;

                if (isHttpLink(rawTarget)) {
                    const extNode = makeExternalNodeFromUrl(rawTarget);
                    if (!extNode) continue;
                    addExternalNodesToGraph([extNode]);
                    await persistExternalNodes([extNode]);
                    rememberLink(cleanSource, extNode.id, record);
                    await saveFoundEdge({
                        source: cleanSource,
                        target: extNode.id,
                        linkKind: record.linkKind,
                        linkProperty: record.linkProperty,
                        linkText: record.linkText,
                        tags: record.tags,
                        symbols: record.symbols,
                        displayText: record.displayText,
                        edgeLabel: makeEdgeLabel(record)
                    });
                    continue;
                }

                const cleanTarget = normalizePath(linkRecordTargetId(record));
                if (!cleanTarget) continue;

                const exists = await notebookAssetExists(cleanTarget);
                if (!exists) {
                    rememberBrokenLink(cleanSource, cleanTarget);
                    applyBrokenLinkBadge(cleanSource);
                    continue;
                }

                rememberLink(cleanSource, cleanTarget, record);

                await saveFoundEdge({
                    source: cleanSource,
                    target: cleanTarget,
                    linkKind: record.linkKind,
                    linkProperty: record.linkProperty,
                    linkText: record.linkText,
                    tags: record.tags,
                    symbols: record.symbols,
                    displayText: record.displayText,
                    edgeLabel: makeEdgeLabel(record)
                });
            }
        }
        applyBrokenLinkBadge(cleanSource);
    } catch (err) {
        console.error("Link discovery failed for " + cleanSource + ":", err);
    }
}


async function toggleCompoundDirectory(node) {
    const path = node.data('fullPath');
    const descendants = node.descendants();
    
    if (!descendants.empty()) {
        cy.remove(descendants);
    } else {
        await fetchDirectoryContents(path, (data) => {
            renderGraphData(data, path);
        }, null, null);
    }

    navigationState.setLastOpenedDirectory(path || "", "GraphManager");

    updateDirectoryLevelColors();
    rebuildVisibleEdges();
    queueRelayout({ fit: true, reason: 'toggle-directory' });
}

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

export async function handleGraphManagerAction(actionKey) {
    console.log(`GraphManagerCore: handling toolbar action "${actionKey}"`);

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

window.handleGraphManagerAction = handleGraphManagerAction;

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

function shouldHandleGraphManagerShortcut() {
    const state = window.NodevisionState || {};
    const handlerMatches = state.activeActionHandler === window.handleGraphManagerAction;
    const panelMatches = state.activePanelType === "GraphManager";
    if (panelMatches) return true;
    if (typeof state.activePanelType === "string" && state.activePanelType.trim()) {
        return false;
    }
    return handlerMatches;
}

function registerGraphManagerClipboardShortcuts() {
    if (window.__nvGraphManagerClipboardShortcutsBound) return;

    const listener = async (e) => {
        if (e.altKey || !(e.ctrlKey || e.metaKey) || e.repeat) return;
        const actionKey = CLIPBOARD_SHORTCUTS[e.key?.toLowerCase?.()] || null;
        if (!actionKey) return;
        if (!shouldHandleGraphManagerShortcut()) return;
        if (isEditableTarget(e.target)) return;
        if (typeof window.handleGraphManagerAction !== "function") return;

        e.preventDefault();
        try {
            await window.handleGraphManagerAction(actionKey);
        } catch (err) {
            console.error("GraphManager clipboard shortcut failed:", err);
        }
    };

    document.addEventListener("keydown", listener);
    window.__nvGraphManagerClipboardShortcutsBound = true;
}

registerGraphManagerClipboardShortcuts();

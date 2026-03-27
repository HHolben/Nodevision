// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerCore.mjs
// This file defines browser-side Graph Manager Core logic for the Nodevision UI. It renders interface components and handles user interactions.
import { scanFileForLinks } from './GraphManagerDependencies/ScanForLinks.mjs';
import { saveFoundEdge } from './GraphManagerDependencies/SaveFoundEdge.mjs';
import { getVisibleNodeId } from './GraphManagerDependencies/GetVisibleNodeID.mjs';
import { normalizePath } from './GraphManagerDependencies/NormalizePath.mjs';
import { moveFileOrDirectory } from '/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerAPI.mjs';
import { maybePromptLinkMoveImpact } from '/ToolbarCallbacks/file/linkMoveImpact.mjs';

let cy;
let currentRootPath = '';
const discoveredLinks = new Map(); // sourcePath -> Set(targetPath)
let layoutHasInitialized = false;
let activeLayout = null;
let layoutDebounceTimer = null;
let layoutPendingFit = false;
let layoutPendingReasons = new Set();
let dragMoveState = null;
const EDGE_BUCKET_SYMBOLS = [
    ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ...'0123456789',
    '#',
    '_'
];
const DIRECTORY_IMAGE_CANDIDATES = [
    '.directory.svg',
    '.directory.png',
    'directory.svg',
    'directory.png',
];

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

function toNotebookAssetUrl(relativePath) {
    const parts = String(relativePath)
        .split(/[\\/]+/)
        .filter(Boolean)
        .map(encodeURIComponent);
    return `/Notebook/${parts.join('/')}`;
}

function inferCurrentDirectoryImage(files, parentPath) {
    if (!Array.isArray(files)) return '';

    for (const candidate of DIRECTORY_IMAGE_CANDIDATES) {
        const hit = files.find((entry) => entry && !entry.isDirectory && entry.name === candidate);
        if (!hit) continue;

        if (typeof hit.path === 'string' && hit.path) {
            return toNotebookAssetUrl(hit.path);
        }

        const rel = normalizePath(parentPath)
            ? `${normalizePath(parentPath)}/${candidate}`
            : candidate;
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
    if (activeLayout && typeof activeLayout.stop === 'function') {
        try { activeLayout.stop(); } catch (_) { /* ignore */ }
        activeLayout = null;
    }

    discoveredLinks.clear();
    cy.elements().remove();

    await hydrateDiscoveredLinksFromBuckets();
    await fetchDirectoryContents(currentRootPath, (data) => {
        renderGraphData(data, currentRootPath);
    }, null, null);

    queueRelayout({ fit: Boolean(fit), reason });
}

window.refreshGraphManager = refreshGraphView;

async function ensureDirectoryChainExpanded(targetDirPath) {
    const cleanTarget = normalizePath(targetDirPath);
    if (!cleanTarget) return;

    const parts = cleanTarget.split('/').filter(Boolean);
    let cumulative = '';
    for (const part of parts) {
        cumulative = cumulative ? `${cumulative}/${part}` : part;
        // Render this directory's children so moved nodes remain reachable in the graph.
        await fetchDirectoryContents(cumulative, (data) => {
            renderGraphData(data, cumulative);
        }, null, null);
    }
}

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

function rememberLink(sourcePath, targetPath) {
    const source = normalizePath(sourcePath);
    const target = normalizePath(targetPath);
    if (!source || !target) return;

    let targets = discoveredLinks.get(source);
    if (!targets) {
        targets = new Set();
        discoveredLinks.set(source, targets);
    }
    targets.add(target);
}

function ingestPersistedEdgeData(data) {
    if (!data) return;

    // Current bucket format: [{ source, target }, ...]
    if (Array.isArray(data)) {
        for (const edge of data) {
            if (edge && typeof edge === 'object') {
                rememberLink(edge.source, edge.target);
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

            const key = `${visibleSource}->${visibleTarget}`;
            if (edgeMap.has(key)) continue;

            edgeMap.set(key, {
                group: 'edges',
                data: {
                    id: `edge-${visibleSource}-${visibleTarget}`,
                    source: visibleSource,
                    target: visibleTarget
                }
            });
        }
    }

    cy.batch(() => {
        cy.edges().remove();
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

export async function initGraphView({ containerId, rootPath, statusElemId }) {
    currentRootPath = normalizePath(rootPath);
    discoveredLinks.clear();
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
                    'background-color': '#ffca28',
                    'shape': 'rectangle',
                    // Keep unexpanded directories compact while allowing expanded ones
                    // to size naturally around their children.
                    'min-width': 64,
                    'min-height': 64,
                    'border-width': 1,
                    'border-color': '#b58a19'
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
                selector: 'node[type="directory"][hasDirectoryImage = 1]:childless',
                style: {
                    'background-image': 'data(directoryImageUrl)',
                    'background-fit': 'cover',
                    'background-position-x': '50%',
                    'background-position-y': '50%',
                    'background-repeat': 'no-repeat',
                    'border-width': 1,
                    'border-color': '#b58a19'
                }
            },
            {
                selector: ':parent',
                style: {
                    'background-opacity': 0.1,
                    'background-color': '#ffca28',
                    'border-color': '#ffca28',
                    'border-width': 2,
                    'text-valign': 'top',
                    'text-halign': 'center',
                    // Reduce wasted internal space while preserving label readability.
                    'padding': 10,
                    'text-margin-y': 4,
                    'compound-sizing-wrt-labels': 'include'
                }
            },
            {
                selector: 'node[type="directory"][hasDirectoryImage = 1]:parent',
                style: {
                    'background-image': 'data(directoryImageUrl)',
                    'background-fit': 'cover',
                    'background-position-x': '50%',
                    'background-position-y': '50%',
                    'background-repeat': 'no-repeat',
                    'background-opacity': 0.35
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
                    ...(edgeStyleOverrides || {})
                }
            }
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
        if (path !== undefined) window.selectedFilePath = path;
    });

    cy.on('dblclick', 'node', async (evt) => {
        const node = evt.target;
        if (node.data('type') === 'directory') {
            await toggleCompoundDirectory(node);
        }
    });

    setupCtrlDragMoveHandlers();

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

    if (cy.getElementById(parentId).empty()) {
        cy.add({
            group: 'nodes',
            data: { 
                id: parentId, 
                label: parentId === "Root" ? "🏠 Notebook" : parentId.split('/').pop(), 
                type: 'directory', 
                fullPath: normalizedParentPath,
                directoryImageUrl: currentDirectoryImage,
                hasDirectoryImage: currentDirectoryImage ? 1 : 0
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
                        hasDirectoryImage: directoryImageUrl ? 1 : 0
                    }
                });
            } else if (f.isDirectory) {
                const existing = cy.getElementById(fullPath);
                existing.data('directoryImageUrl', directoryImageUrl);
                existing.data('hasDirectoryImage', directoryImageUrl ? 1 : 0);
            }

            if (!f.isDirectory) {
                const ext = f.name.split('.').pop().toLowerCase();
                if (ext === 'html' || ext === 'md') {
                    filesToScan.push(fullPath);
                }
            }
        });
    });

    // Give newly added nodes a reasonable placement quickly.
    queueRelayout({ fit: false, reason: 'nodes-added' });

    // Scan for links AFTER nodes are added to the graph instance
    for (const filePath of filesToScan) {
        await handleLinkDiscovery(filePath);
    }

    rebuildVisibleEdges();
    // Final relayout after edges exist so connected structures pack better.
    queueRelayout({ fit: true, reason: 'edges-updated' });
}

async function handleLinkDiscovery(filePath) {
    const cleanSource = normalizePath(filePath);
    try {
        const links = await scanFileForLinks(cleanSource);
        
        if (links && Array.isArray(links)) {
            for (const rawTarget of links) {
                const resolvedTarget = resolveNotebookLink(cleanSource, rawTarget);
                if (!resolvedTarget) continue;

                const cleanTarget = normalizePath(resolvedTarget);
                console.log("Clean Target: "+cleanTarget);
    
                rememberLink(cleanSource, cleanTarget);

                // Persist
                await saveFoundEdge({ source: cleanSource, target: cleanTarget });
            }
        }
    } catch (err) {
        console.error(`Link discovery failed for ${cleanSource}:`, err);
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

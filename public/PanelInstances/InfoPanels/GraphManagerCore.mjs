// Nodevision/public/PanelInstances/InfoPanels/GraphManagerCore.mjs
import { fetchDirectoryContents } from './FileManagerCore.mjs';
import { scanFileForLinks } from './GraphManagerDependencies/ScanForLinks.mjs';
import { saveFoundEdge } from './GraphManagerDependencies/SaveFoundEdge.mjs';
import { getVisibleNodeId } from './GraphManagerDependencies/GetVisibleNodeID.mjs';
import { normalizePath } from './GraphManagerDependencies/NormalizePath.mjs';

let cy;
let currentRootPath = '';
const discoveredLinks = new Map(); // sourcePath -> Set(targetPath)
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

export async function initGraphView({ containerId, rootPath, statusElemId }) {
    currentRootPath = normalizePath(rootPath);
    discoveredLinks.clear();
    const container = document.getElementById(containerId);
    const statusElem = statusElemId ? document.getElementById(statusElemId) : null;

    cy = cytoscape({
        container: container,
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'color': '#333',
                    'background-color': '#0078d7',
                    'font-size': '10px',
                    'z-index': 10
                }
            },
            {
                selector: 'node[type="directory"]',
                style: {
                    'background-color': '#ffca28',
                    'shape': 'rectangle',
                    'width': '64px',
                    'height': '64px'
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
                    'text-halign': 'center'
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
                selector: 'edge',
                style: { 
                    'width': 2, 
                    'line-color': '#adadad',
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': '#adadad',
                    'curve-style': 'bezier',
                    'opacity': 0.8,
                    'arrow-scale': 1.2
                }
            }
        ],
        layout: { name: 'cose', padding: 30 }
    });

    window.cy = cy;

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

    // Run layout first so nodes have positions
    cy.layout({ name: 'cose', animate: true, fit: true }).run();

    // Scan for links AFTER nodes are added to the graph instance
    for (const filePath of filesToScan) {
        await handleLinkDiscovery(filePath);
    }

    rebuildVisibleEdges();
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
    cy.layout({ name: 'cose', animate: true }).run();
}

// Nodevision/public/PanelInstances/InfoPanels/GraphManagerCore.mjs
import { fetchDirectoryContents } from './FileManagerCore.mjs';
import { scanFileForLinks } from './GraphManagerDependencies/ScanForLinks.mjs';
import { saveFoundEdge } from './GraphManagerDependencies/SaveFoundEdge.mjs';
import { getVisibleNodeId } from './GraphManagerDependencies/GetVisibleNodeID.mjs';
import { normalizePath } from './GraphManagerDependencies/NormalizePath.mjs';

let cy;
let currentRootPath = '';

export async function initGraphView({ containerId, rootPath, statusElemId }) {
    currentRootPath = normalizePath(rootPath);
    const container = document.getElementById(containerId);
    const statusElem = document.getElementById(statusElemId);

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
                    'width': '50px',
                    'height': '30px'
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

    statusElem.textContent = "Fetching Files...";
    await fetchDirectoryContents(currentRootPath, (data) => {
        renderGraphData(data, currentRootPath);
        statusElem.textContent = "Ready";
    }, null, null);
}

async function renderGraphData(files, parentPath) {
    if (!files) return;

    const normalizedParentPath = normalizePath(parentPath);
    const parentId = normalizedParentPath || "Root";

    if (cy.getElementById(parentId).empty()) {
        cy.add({
            group: 'nodes',
            data: { 
                id: parentId, 
                label: parentId === "Root" ? "🏠 Notebook" : parentId.split('/').pop(), 
                type: 'directory', 
                fullPath: normalizedParentPath 
            }
        });
    }

    const filesToScan = [];

    cy.batch(() => {
        files.forEach(f => {
            const rawPath = parentPath ? `${parentPath}/${f.name}` : f.name;
            const fullPath = normalizePath(rawPath);
            
            if (cy.getElementById(fullPath).empty()) {
                cy.add({
                    group: 'nodes',
                    data: {
                        id: fullPath,
                        label: f.name,
                        fullPath: fullPath,
                        type: f.isDirectory ? 'directory' : 'file',
                        parent: parentId 
                    }
                });

                if (!f.isDirectory) {
                    const ext = f.name.split('.').pop().toLowerCase();
                    if (ext === 'html' || ext === 'md') {
                        filesToScan.push(fullPath);
                    }
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
}

async function handleLinkDiscovery(filePath) {
    const cleanSource = normalizePath(filePath);
    try {
        const links = await scanFileForLinks(cleanSource);
        
        if (links && Array.isArray(links)) {
            for (const targetPath of links) {
                const cleanTarget = normalizePath(targetPath);
                console.log("Clean Target: "+cleanTarget);
    

                // Persist
                await saveFoundEdge({ source: cleanSource, target: cleanTarget });

                // Find visible endpoints
                const visibleSource = getVisibleNodeId(cy, cleanSource);
                const visibleTarget = getVisibleNodeId(cy, cleanTarget);
                console.log("Visible Target:" + visibleTarget);

                // DEBUG: If you still see root edges, check these logs
                console.log(`Link: ${cleanSource} -> ${cleanTarget} | Visual: ${visibleSource} -> ${visibleTarget}`);

                if (visibleSource !== visibleTarget) {
                    const edgeId = `edge-${visibleSource}-${visibleTarget}`;
                    
                    if (cy.getElementById(edgeId).empty()) {
                        cy.add({
                            group: 'edges',
                            data: {
                                id: edgeId,
                                source: visibleSource,
                                target: visibleTarget
                            }
                        });

                    }
                }
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
    cy.layout({ name: 'cose', animate: true }).run();
}
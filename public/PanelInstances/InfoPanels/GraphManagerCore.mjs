// Nodevision/public/PanelInstances/InfoPanels/GraphManagerCore.mjs
import { fetchDirectoryContents } from './FileManagerCore.mjs';
import { scanFileForLinks } from './GraphManagerDependencies/ScanForLinks.mjs';
import { saveFoundEdge } from './GraphManagerDependencies/SaveFoundEdge.mjs'; // Added import

let cy;
let currentRootPath = '';

export async function initGraphView({ containerId, rootPath, statusElemId }) {
    currentRootPath = rootPath;
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
                    'font-size': '10px'
                }
            },
            // Style for the "Collapsed" Directory
            {
                selector: 'node[type="directory"]',
                style: {
                    'background-color': '#ffca28',
                    'shape': 'rectangle',
                    'width': '50px',
                    'height': '30px'
                }
            },
            // Style for the "Expanded" Compound Node
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
                style: { 'width': 1, 'line-color': '#ccc' }
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
    await fetchDirectoryContents(rootPath, (data) => {
        renderGraphData(data, rootPath);
        statusElem.textContent = "Ready";
    }, null, null);
}

function renderGraphData(files, parentPath) {
    if (!files) return;

    const parentId = parentPath || "Root";
    
    if (cy.getElementById(parentId).empty()) {
        cy.add({
            group: 'nodes',
            data: { 
                id: parentId, 
                label: parentId === "Root" ? "🏠 Notebook" : parentId.split('/').pop(), 
                type: 'directory', 
                fullPath: parentPath 
            }
        });
    }

    cy.batch(() => {
        files.forEach(f => {
            const fullPath = (parentPath ? `${parentPath}/${f.name}` : f.name).replace(/\/+/g, "/");
            
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
                        // Trigger scan and save logic
                        handleLinkDiscovery(fullPath);
                    }
                }
            }
        });
    });

    cy.layout({ name: 'cose', animate: true }).run();
}

/**
 * Helper to scan a file and save any found edges to the JSON shards
 */
async function handleLinkDiscovery(filePath) {
    try {
        const links = await scanFileForLinks(filePath);
        
        if (links && Array.isArray(links)) {
            // Use a for...of loop for async operations to ensure 
            // shards are updated sequentially rather than overlapping.
            for (const targetPath of links) {
                await saveFoundEdge({
                    source: filePath,
                    target: targetPath
                });
            }
        }
    } catch (err) {
        console.error(`Link discovery failed for ${filePath}:`, err);
    }
}

async function toggleCompoundDirectory(node) {
    const path = node.data('fullPath');
    
    // Find children that currently have this node as a parent
    const children = cy.nodes().filter(n => n.data('parent') === node.id());
    
    if (children.length > 0) {
        // COLLAPSE: Remove all children recursively
        // We use a selector to find all descendants
        const descendants = node.descendants();
        cy.remove(descendants);
        
        // After removing children, the node reverts to a regular rectangle via style
        console.log("Collapsed directory:", path);
    } else {
        // EXPAND: Fetch contents and add them as children
        await fetchDirectoryContents(path, (data) => {
            renderGraphData(data, path);
        }, null, null);
        console.log("Expanded directory to compound node:", path);
    }
    
    cy.layout({ name: 'cose', animate: true }).run();
}

window.refreshGraphManager = async function() {
    cy.elements().remove();
    await fetchDirectoryContents(currentRootPath, (data) => {
        renderGraphData(data, currentRootPath);
    });
};
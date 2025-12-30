// Nodevision/public/PanelInstances/InfoPanels/GraphManagerCore.mjs

import { fetchDirectoryContents } from './FileManagerCore.mjs';

let cy;
let currentRootPath = '';

/**
 * Initialize the Cytoscape Graph
 */
export async function initGraphView({ containerId, rootPath, statusElemId }) {
    // 1. Assign state variables
    currentRootPath = rootPath;
    const container = document.getElementById(containerId);
    const statusElem = document.getElementById(statusElemId);

    if (!container) {
        console.error("❌ Graph container not found:", containerId);
        return;
    }

    // 2. Initialize Cytoscape Instance
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
                    'width': '40px',
                    'height': '40px',
                    'font-size': '10px',
                    'text-wrap': 'wrap',
                    'text-max-width': '80px'
                }
            },
            {
                selector: 'node[type="directory"]',
                style: {
                    'background-color': '#ffca28',
                    'shape': 'rectangle',
                    'width': '50px'
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-width': '4px',
                    'border-color': '#005a9e'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#ccc',
                    'target-arrow-color': '#ccc',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
                }
            }
        ],
        layout: { name: 'grid' }
    });

    // 3. Expose to global window for console troubleshooting
    window.cy = cy;
    console.log("🕸️ Cytoscape instance exposed to window.cy");

    // 4. Interaction Handlers
    cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        const path = node.data('fullPath');
        if (path !== undefined) {
            window.selectedFilePath = path;
            console.log("🎯 Graph Selection:", path);
        }
    });

    cy.on('dblclick', 'node', async (evt) => {
        const node = evt.target;
        if (node.data('type') === 'directory') {
            await toggleDirectory(node);
        }
    });

    // 5. Load Initial Data
    statusElem.textContent = "Fetching Files...";
    await fetchDirectoryContents(rootPath, (data) => {
        renderGraphData(data, rootPath);
        statusElem.textContent = "Ready";
    }, null, null);
}

/**
 * Renders nodes and creates edges to a parent
 */
function renderGraphData(files, parentPath) {
    if (!files) return;

    // Ensure a 'Parent' node exists to act as the hub
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
            
            // Add Node
            if (cy.getElementById(fullPath).empty()) {
                cy.add({
                    group: 'nodes',
                    data: {
                        id: fullPath,
                        label: f.name,
                        fullPath: fullPath,
                        type: f.isDirectory ? 'directory' : 'file'
                    }
                });
                
                // Add Edge from current view hub to this child
                cy.add({
                    group: 'edges',
                    data: { 
                        id: `edge-${parentId}-${fullPath}`,
                        source: parentId, 
                        target: fullPath 
                    }
                });
            }
        });
    });

    // Apply a clean physics-based layout
    cy.layout({ 
        name: 'cose', 
        animate: true, 
        randomize: false, 
        nodeRepulsion: 8000 
    }).run();
}

/**
 * Handles Expanding/Collapsing via double-click
 */
async function toggleDirectory(node) {
    const path = node.data('fullPath');
    
    // Find existing children (any node whose ID starts with 'path/')
    const children = cy.nodes().filter(n => n.id().startsWith(path + '/') && n.id() !== path);
    
    if (children.length > 0) {
        // Collapse: Remove them
        cy.remove(children);
    } else {
        // Expand: Fetch and Render
        await fetchDirectoryContents(path, (data) => {
            renderGraphData(data, path);
        }, null, null);
    }
}

/**
 * Toolbar Action Dispatcher
 */
export async function handleGraphManagerAction(actionKey) {
    console.log(`GraphManager: Action "${actionKey}" routed to File System`);
    try {
        const modulePath = `/ToolbarCallbacks/file/${actionKey}.mjs`;
        const callbackModule = await import(modulePath);
        await callbackModule.default();
        // Refresh graph after action (e.g., delete or new file)
        window.refreshGraphManager();
    } catch (err) {
        console.error("Action handler failed:", err);
    }
}
window.handleGraphManagerAction = handleGraphManagerAction;

/**
 * Global Refresh
 */
window.refreshGraphManager = async function() {
    cy.elements().remove();
    await fetchDirectoryContents(currentRootPath, (data) => {
        renderGraphData(data, currentRootPath);
    });
};
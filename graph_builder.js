// graph_builder.js
// Purpose: Core graph construction logic and data structure management

const fs = require('fs');
const path = require('path');
const NodevisionDB = require('nodevisiondb'); // Make sure this is installed

const NOTEBOOK_DIR = path.join(__dirname, 'Notebook');
const db = NodevisionDB.createGraphDB(); // Initialize database

// Store nodes and regions
const nodes = new Map();
const regions = new Map();

// Recursive function to traverse the directory structure
function processDirectory(dirPath, parentRegion = null) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            // Create a region (directory)
            const regionId = `region:${fullPath}`;
            regions.set(regionId, { name: entry.name, path: fullPath });

            if (parentRegion) {
                db.createEdge(parentRegion, regionId); // Parent-child relation
            }

            processDirectory(fullPath, regionId); // Recurse into directory
        } else if (entry.isFile()) {
            // Create a file node
            const nodeId = `file:${fullPath}`;
            nodes.set(nodeId, { name: entry.name, path: fullPath });

            if (parentRegion) {
                db.createEdge(parentRegion, nodeId); // File belongs to a region
            }
        }
    }
}

// Start processing from the root notebook directory
processDirectory(NOTEBOOK_DIR);

// Store nodes and regions in the database
for (const [id, data] of nodes) {
    db.createNode(id, data.name, data.path);
}
for (const [id, data] of regions) {
    db.createRegion(id, data.name, data.path);
}

// Save the graph
db.saveGraph(); 

console.log('Graph built successfully!');

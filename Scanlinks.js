const fs = require('fs');
const path = require('path');

// Path to the GeneratedNodes.js file
const nodesPath = path.join(__dirname, 'public', 'GeneratedNodes.js');

// Attempt to load nodes
let nodes;
try {
    nodes = require(nodesPath);  // Load nodes directly as an array
    if (nodes && nodes.length > 0) {
        console.log(`${nodes.length} nodes loaded successfully.`);
    } else {
        console.error("No nodes were loaded from GeneratedNodes.js");
        process.exit(1);
    }
} catch (error) {
    console.error("Error loading nodes:", error);
    process.exit(1);
}

// Function to fetch the file content of a node
function fetchFileContent(filepath) {
    try {
        return fs.readFileSync(filepath, 'utf-8');
    } catch (err) {
        console.error(`Error reading file ${filepath}:`, err);
        return null;
    }
}

// Function to extract hyperlinks from HTML content
function extractHyperlinks(htmlContent) {
    const anchorTags = htmlContent.match(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi) || [];
    return anchorTags.map(tag => {
        const match = tag.match(/href=(["'])(.*?)\1/);
        return match ? match[2] : null;
    }).filter(Boolean); // Filter out nulls
}

// Log links in Cytoscape.js format
function logLinksForCytoscape() {
    nodes.forEach(node => {
        const nodeId = path.join(__dirname, node.data.link);  // Construct the full path for the node
        const fileContent = fetchFileContent(nodeId);  // Fetch the file content

        if (!fileContent) {
            console.log(`No content found for node: ${node.data.id}`);
            return;
        }

        const hyperlinks = extractHyperlinks(fileContent);  // Extract hyperlinks
        hyperlinks.forEach(link => {
            const targetNode = nodes.find(n => path.basename(n.data.link) === link);  // Find matching node by filename
            if (targetNode) {
                console.log(`{ "data": { "id": "${node.data.id}_to_${targetNode.data.id}", "source": "${node.data.id}", "target": "${targetNode.data.id}" } }`);
            }
        });
    });
}

// Call the function to log links in Cytoscape.js format
logLinksForCytoscape();

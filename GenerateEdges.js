const fs = require('fs');
const path = require('path');

// Path to the GeneratedNodes.js file
const nodesPath = path.join(__dirname, 'public', 'GeneratedNodes.js');

// Path to the output file for edges
const generatedEdgesPath = path.join(__dirname, 'public', 'GeneratedEdges.js');

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

// Array to store the edges
const edges = [];

// Function to generate edges in Cytoscape.js format
function generateEdgesForCytoscape() {
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
                const edge = {
                    data: {
                        id: `${node.data.id}_to_${targetNode.data.id}`,
                        source: node.data.id,
                        target: targetNode.data.id
                    }
                };
                edges.push(edge);  // Add the edge to the array
            }
        });
    });

    if (edges.length > 0) {
        console.log(`${edges.length} edges generated successfully.`);
    } else {
        console.log("No edges generated.");
    }
}

// Call the function to generate edges
generateEdgesForCytoscape();

// Generate the output for GeneratedEdges.js
const edgesOutput = `// GeneratedEdges.js\nconst edges = [\n${edges.map(edge => JSON.stringify(edge)).join(',\n')}\n];\nmodule.exports = edges;\n`;

// Write the edges to the output file
fs.writeFileSync(generatedEdgesPath, edgesOutput, 'utf8');
console.log(`Generated edges have been written to ${generatedEdgesPath}`);

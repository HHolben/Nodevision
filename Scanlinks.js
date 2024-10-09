const path = require('path');
const fs = require('fs');

// Load GeneratedNodes.js
const nodesPath = path.join(__dirname, 'public', 'GeneratedNodes.js');

// Function to load nodes from GeneratedNodes.js
function loadNodes() {
    try {
        return require(nodesPath); // Dynamically require the file
    } catch (error) {
        console.error("Error loading nodes:", error);
        return null;
    }
}

// Function to fetch the file content of a node
function fetchFileContent(filepath) {
    const fullPath = path.join(__dirname, 'Notebook', filepath); // Full path to the file
    try {
        return fs.readFileSync(fullPath, 'utf-8'); // Read the file content
    } catch (err) {
        console.error(`Error reading file ${fullPath}:`, err);
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

// Function to extract file references from JS, PHP, or Python content
function extractFileReferences(scriptContent) {
    const importStatements = scriptContent.match(/(import|require|include)\(["'](.*?)["']\)/g) || [];
    return importStatements.map(statement => {
        const match = statement.match(/["'](.*?)["']/);
        return match ? match[1] : null;
    }).filter(Boolean); // Filter out nulls
}

// Function to process each node and extract links or references
function processNodes(nodes) {
    nodes.forEach(node => {
        const nodeId = node.data.id; // Filepath of the node
        const fileContent = fetchFileContent(nodeId); // Get the file content

        if (!fileContent) {
            console.log(`No content found for node: ${nodeId}`);
            return;
        }

        // Extract references based on file type
        if (nodeId.endsWith('.html')) {
            const hyperlinks = extractHyperlinks(fileContent); // Extract hyperlinks from HTML files
            console.log(`Links found in ${nodeId}:`, hyperlinks);
        } else if (nodeId.endsWith('.js') || nodeId.endsWith('.php') || nodeId.endsWith('.py')) {
            const fileRefs = extractFileReferences(fileContent); // Extract imports/requires from JS/PHP/Python files
            console.log(`File references found in ${nodeId}:`, fileRefs);
        } else {
            console.log(`Unsupported file type for node: ${nodeId}`);
        }
    });
}

// Main function to load and process nodes
function main() {
    const nodes = loadNodes(); // Load nodes from GeneratedNodes.js
    if (!nodes || nodes.length === 0) {
        console.log("No nodes were loaded. Please check if GeneratedNodes.js contains nodes.");
        return;
    }
    processNodes(nodes); // Process nodes and extract links
}

main();

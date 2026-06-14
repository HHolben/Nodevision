// Nodevision/ApplicationSystem/GenerateEdges.js
// This file defines the Generate Edges module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
// GenerateEdges.js
// Purpose: Create edges and relationships between graph nodes based on file links

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

function shouldIgnoreLink(rawLink) {
    const link = String(rawLink || '').trim();
    if (!link || link.startsWith('#')) return true;
    return /^(data|javascript|mailto|file):/i.test(link) || /^\/\//.test(link);
}

function uniqueLinks(links) {
    const seen = new Set();
    return links
        .map(link => String(link || '').trim())
        .filter(link => {
            if (shouldIgnoreLink(link) || seen.has(link)) return false;
            seen.add(link);
            return true;
        });
}

// Function to extract hyperlinks and CSS asset references from HTML content
function extractHyperlinks(htmlContent) {
    const links = [];
    const attrRegex = /(?:href|src|data-nodevision-font-src|data-nodevision-font-stylesheet)\s*=\s*(["'])(.*?)\1/gi;
    for (const match of htmlContent.matchAll(attrRegex)) {
        links.push(match[2]);
    }
    const cssUrlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'"\)]+))\s*\)/gi;
    for (const match of htmlContent.matchAll(cssUrlRegex)) {
        links.push(match[1] || match[2] || match[3]);
    }
    // External http(s) URLs are left in the result. TODO: create external graph nodes when supported.
    return uniqueLinks(links);
}


// Array to store the edges
const edges = [];

// Function to generate edges in Cytoscape.js format
function generateEdgesForCytoscape() {
    const folderNodes = new Set(); // To track folder nodes created

    nodes.forEach(node => {
        const nodeId = path.join(__dirname, node.data.link);  // Construct the full path for the node
        const fileContent = fetchFileContent(nodeId);  // Fetch the file content

        if (!fileContent) {
            console.log(`No content found for node: ${node.data.id}`);
            return;
        }

        const hyperlinks = extractHyperlinks(fileContent);  // Extract hyperlinks
        console.log("Extracted Links:", hyperlinks);
        


        hyperlinks.forEach(link => {
            // Check if the link is an external URL
            const isExternalLink = /^https?:\/\//i.test(link);
            if (isExternalLink) {
                console.log(`Ignoring external link: ${link}`);
                return; // Skip this link
            }

            // Check if the link is a folder path
            const isFolderPath = link.includes('/');
            let targetNode;

            if (isFolderPath) {
                // Extract folder name (assuming the last part of the path is the folder)
                const folderName = link.split('/')[0]; // Get the first part as folder
                targetNode = {
                    data: {
                        id: folderName, // Use folder name as ID
                        link: folderName // Store folder name or path if needed
                    }
                };

                // Check if the folder node already exists
                if (!folderNodes.has(folderName)) {
                    folderNodes.add(folderName);
                    nodes.push(targetNode); // Add folder node to nodes array
                    console.log(`Folder node created: ${folderName}`);
                }
            } else {
                // If it's a file, find the corresponding node
                targetNode = nodes.find(n => path.basename(n.data.link) === link);
            }

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
const edgesOutput = `// GeneratedEdges.js\nconst edges = [\n${edges.map(edge => JSON.stringify(edge)).join(',\n')}\n];\n`;

// Write the edges to the output file
fs.writeFileSync(generatedEdgesPath, edgesOutput, 'utf8');
console.log(`Generated edges have been written to ${generatedEdgesPath}`);

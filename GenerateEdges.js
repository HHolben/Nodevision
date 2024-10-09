const path = require('path');  // Path module to handle directory paths
const fs = require('fs');      // Filesystem module

// Construct the correct path to the GeneratedNodes.js file
const nodesPath = path.join(__dirname, 'public', 'GeneratedNodes.js');

let nodes;
try {
    if (fs.existsSync(nodesPath)) {
        // Read the file content and evaluate it to load the nodes
        const fileContent = fs.readFileSync(nodesPath, 'utf-8');
        nodes = eval(fileContent);  // Use eval to parse the content (only if safe and trusted!)
        console.log("Nodes loaded successfully.");
    } else {
        console.error(`The file ${nodesPath} does not exist.`);
    }
} catch (error) {
    console.error("Error loading nodes:", error);
}

// Function to fetch the file content of a node (using Node.js fs module)
async function fetchFileContent(filepath) {
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

// Function to extract file references from JS, PHP, or Python content
function extractFileReferences(scriptContent) {
    const importStatements = scriptContent.match(/(import|require)\(["'](.*?)["']\)/g) || [];
    return importStatements.map(statement => {
        const match = statement.match(/["'](.*?)["']/);
        return match ? match[1] : null;
    }).filter(Boolean); // Filter out nulls
}

// Function to generate edges between existing nodes and write them to a file
async function generateEdgesAndWriteToFile(nodes, outputPath) {
    let edges = []; // Array to store edges

    // Iterate over each node to check for references to other nodes
    for (const node of nodes) {
        const nodeId = node.id; // Node ID corresponds to the file path
        const fileContent = await fetchFileContent(nodeId); // Fetch content of the corresponding file

        if (!fileContent) {
            console.log(`No content found for node: ${nodeId}`);
            continue;
        }

        let references = [];

        // Extract references based on file type
        if (nodeId.endsWith('.html')) {
            references = extractHyperlinks(fileContent); // Extract hyperlinks from HTML files
        } else if (nodeId.endsWith('.js') || nodeId.endsWith('.php') || nodeId.endsWith('.py')) {
            references = extractFileReferences(fileContent); // Extract imports/requires from JS/PHP/Python
        }

        // For each reference, check if there's a matching node and create an edge entry
        references.forEach(reference => {
            const targetNode = nodes.find(n => n.id === reference); // Check if the reference corresponds to another node

            if (targetNode) {
                const edge = {
                    id: `${nodeId}_to_${targetNode.id}`,
                    source: nodeId,
                    target: targetNode.id,
                };

                edges.push(edge);
                console.log(`Edge added: ${nodeId} -> ${targetNode.id}`);
            }
        });
    }

    // Write the edges array to a file
    const edgeFileContent = `
const edges = ${JSON.stringify(edges, null, 4)};
export default edges;
`;
    fs.writeFileSync(outputPath, edgeFileContent, 'utf8');
    console.log(`Edges written to ${outputPath}`);
}

// Main function
async function main() {
    const outputPath = path.join(__dirname, 'GeneratedEdges.js'); // Output path for the edges file

    if (nodes) {
        await generateEdgesAndWriteToFile(nodes, outputPath);
    } else {
        console.error("No nodes were loaded. Edge generation skipped.");
    }
}

main().catch(err => {
    console.error('Error generating edges:', err);
});

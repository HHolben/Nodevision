const fs = require('fs').promises;
const path = require('path');
const cytoscape = require('cytoscape');

async function generateEdges() {
    // Create a new Cytoscape instance
    const cy = cytoscape({
        elements: [],  // Initialize with empty elements
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#666',
                    'label': 'data(id)'
                }
            },
            {
                selector: 'edge',
                style: {
                    'curve-style': 'bezier',
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': '#333',
                    'line-color': '#333',
                    'width': 2
                }
            }
        ]
    });

    // Load the current graph data
    const graphData = await fs.readFile(path.join(__dirname, 'GeneratedEdges.js'), 'utf8');
    const graph = JSON.parse(graphData);
    cy.json(graph);

    // Iterate over nodes and add edges based on links found in files
    for (const node of cy.nodes()) {
        const filePath = path.join(__dirname, 'Notebook', node.id());
        const fileContent = await fs.readFile(filePath, 'utf8');

        // Extract links from file content
        const linkRegex = /href\s*=\s*['"]([^'"]+)['"]/gi;
        let match;
        while ((match = linkRegex.exec(fileContent)) !== null) {
            const link = match[1];
            const linkPath = path.join(path.dirname(filePath), link);
            const linkNodeId = path.relative(__dirname, linkPath);

            if (cy.getElementById(linkNodeId).length > 0) {
                cy.add({
                    group: 'edges',
                    data: {
                        id: `edge-${node.id()}-${linkNodeId}`,
                        source: node.id(),
                        target: linkNodeId
                    }
                });
            }
        }
    }

    // Save the updated graph data
    const updatedGraphData = cy.json();
    await fs.writeFile(path.join(__dirname, 'GeneratedEdges.js'), JSON.stringify(updatedGraphData), 'utf8');
}

module.exports = { generateEdges };

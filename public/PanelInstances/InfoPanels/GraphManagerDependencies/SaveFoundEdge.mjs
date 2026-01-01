//Nodevision/public/PanelInstances/InfoPanels/GraphManagerDependencies/SaveFoundEdge.mjs
//Saves an edge (link) to a partitioned JSON file in Nodevision/public/data/edges.The partition is based on the first character of the destination node's name.@param {Object} edge - The edge object, e.g., { source: 'file1.md', target: 'file2.md' }


/**
 * Saves an edge to a shard file on the server.
 * Sharding helps prevent one massive JSON file from slowing down the browser.
 */

export async function saveFoundEdge(edgeData) {
    if (!edgeData.source || !edgeData.target) return;

    // The backend uses the first char of 'filename' to pick the bucket
    // If target is "Manual.md", bucket will be "M.json"
    const targetFileName = edgeData.target.split('/').pop() || 'unknown';
    
    // Paths
    const readUrl = `/public/data/edges/${targetFileName[0].toUpperCase()}.json`;
    const writeUrl = `/api/graph/save-edges`;

    try {
        let existingEdges = [];
        
        // 1. Try to get existing edges for this bucket
        const response = await fetch(readUrl);
        if (response.ok) {
            const text = await response.text();
            existingEdges = text.trim() ? JSON.parse(text) : [];
        }

        // 2. Prevent duplicates
        const isDuplicate = existingEdges.some(e => 
            e.source === edgeData.source && e.target === edgeData.target
        );

        if (!isDuplicate) {
            existingEdges.push(edgeData);
            console.log(`📤 Requesting save for bucket [${targetFileName[0].toUpperCase()}]`);

            // 3. POST to the new backend route
            const saveResponse = await fetch(writeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: targetFileName, // Backend extracts [0] from this
                    data: existingEdges       // Backend saves this object
                })
            });

            const result = await saveResponse.json();
            if (result.success) {
                console.log(`✅ Edge saved to bucket: ${result.bucket}`);
            }
        }
    } catch (err) {
        // Syntax errors usually mean the file was empty or 404
        if (!(err instanceof SyntaxError)) {
            console.error(`❌ Error in SaveFoundEdge:`, err);
        }
    }
}
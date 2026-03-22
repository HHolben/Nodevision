// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/SaveFoundEdge.mjs
// This file defines browser-side Save Found Edge logic for the Nodevision UI. It renders interface components and handles user interactions.


/**
 * Saves an edge to a shard file on the server.
 * Sharding helps prevent one massive JSON file from slowing down the browser.
 */

export async function saveFoundEdge(edgeData) {
    if (!edgeData.source || !edgeData.target) return;

    try {
        // The backend uses the first character of `filename` to pick the bucket.
        // Send a minimal payload; the server merges/dedupes so clients can't clobber shards.
        const targetFileName = edgeData.target.split('/').pop() || 'unknown';
        const saveResponse = await fetch(`/api/graph/save-edges`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: targetFileName,
                data: [edgeData]
            })
        });

        const result = await saveResponse.json().catch(() => null);
        if (result?.success) {
            console.log(`✅ Edge saved to bucket: ${result.bucket}`);
        } else if (!saveResponse.ok) {
            console.warn(`⚠️ Edge save failed (${saveResponse.status})`, result?.error);
        }
    } catch (err) {
        console.error(`❌ Error in SaveFoundEdge:`, err);
    }
}

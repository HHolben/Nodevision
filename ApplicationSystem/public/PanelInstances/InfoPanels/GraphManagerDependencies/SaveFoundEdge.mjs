// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/SaveFoundEdge.mjs
// This file defines browser-side Save Found Edge logic for the Nodevision UI. It renders interface components and handles user interactions.


/**
 * Saves an edge to a shard file on the server.
 * Sharding helps prevent one massive JSON file from slowing down the browser.
 */

export async function saveFoundEdge(edgeData) {
    if (!edgeData?.source || !edgeData?.target) return;
    const [result] = await saveFoundEdgesBatch([edgeData]);
    return result;
}

export async function saveFoundEdgesBatch(edgeDataList = []) {
    const edges = Array.isArray(edgeDataList)
        ? edgeDataList.filter((edgeData) => edgeData?.source && edgeData?.target)
        : [];
    if (!edges.length) return [];

    try {
        // The backend groups by target filename and merges/dedupes so clients cannot clobber shards.
        const saveResponse = await fetch(`/api/graph/save-edges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: edges })
        });

        const result = await saveResponse.json().catch(() => null);
        if (result?.success) {
            console.log(`✅ Saved ${result.edgeCount || edges.length} graph edges to ${result.bucketCount || 1} bucket(s).`);
        } else if (!saveResponse.ok) {
            console.warn(`⚠️ Edge save failed (${saveResponse.status})`, result?.error);
        }
        return result?.results || [];
    } catch (err) {
        console.error(`❌ Error in SaveFoundEdge:`, err);
    }
    return [];
}

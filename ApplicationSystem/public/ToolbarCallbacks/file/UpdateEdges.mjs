// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/UpdateEdges.mjs
// This file defines browser-side Update Edges logic for the Nodevision UI. It renders interface components and handles user interactions.

export default async function extractEdgesAndSave() {
  console.log("Extracting Edges!");
  const filePath = window.selectedFilePath;
  if (!filePath) {
    console.warn('[extractEdges] No selected file.');
    return [];
  }

  console.log('📄 [extractEdges] Scanning file for edges:', filePath);

  try {
    // 1️⃣ Extract edges from the file
    const res = await fetch(`/api/extractEdges?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();

    if (!data.edges || data.edges.length === 0) {
      console.log('[extractEdges] No edges detected.');
      return [];
    }

    console.log('📌 [extractEdges] Detected edges:', data.edges);

    // 2️⃣ Prepare JSON content
    const filename = filePath.replace(/[\/\\]/g, '_') + '_edges.json';
    const content = JSON.stringify({ edges: data.edges }, null, 2);

    // 3️⃣ Save edges via your save-data endpoint
    const saveRes = await fetch('/api/files/save-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content })
    });

    const saveData = await saveRes.json();

    if (saveData.success) {
      console.log(`💾 [extractEdges] Saved edges to: ${saveData.saved}`);
    } else {
      console.warn('[extractEdges] Failed to save edges:', saveData.error);
    }

    return data.edges;
  } catch (err) {
    console.error('[extractEdges] ERROR:', err);
    return [];
  }
}

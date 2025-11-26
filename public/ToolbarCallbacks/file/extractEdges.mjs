// Nodevision/public/ToolbarCallbacks/file/extractEdges.mjs
export default async function extractEdges() {
  const filePath = window.selectedFilePath;
  if (!filePath) {
    console.warn('[extractEdges] No selected file.');
    return [];
  }

  console.log('📄 [extractEdges] Scanning file for edges:', filePath);

  try {
    const res = await fetch(`/api/extractEdges?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (!data.edges) return [];
    console.log('📌 [extractEdges] Detected edges:', data.edges);
    return data.edges;
  } catch (err) {
    console.error('[extractEdges] ERROR:', err);
    return [];
  }
}

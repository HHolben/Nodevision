// Nodevision/public/PanelInstances/InfoPanels/GraphManagerDependencies/APIFunctions.mjs

/**
 * Helper: compute bucket symbol for id (first unicode char of local name)
 * @param {string} id
 * @returns {string}
 */
export function bucketSymbolForId(id) {
  const localName = id.split("/").pop() || id;
  return [...localName][0] || "_";
}

/**
 * Helper: compute bucket filename
 * @param {string} id
 * @returns {string}
 */
export function bucketFileForId(id) {
  const sym = bucketSymbolForId(id);
  // normalize filesystem safe name (fallback to '_' for weird)
  const safe = sym === undefined ? "_" : sym;
  return encodeURIComponent(safe) + ".json";
}

/**
 * Fetches the contents of a directory.
 * @param {string} pathId - Project-relative path of the directory.
 * @param {HTMLElement} status - Status element for updating messages.
 * @returns {Promise<{directories: string[], files: string[]}>}
 */
export async function listDirectory(pathId, status) {
  console.log("[APIFunctions] listDirectory:", pathId);
  status.textContent = `Loading ${pathId}...`;
  const q = `/api/listDirectory?path=${encodeURIComponent(pathId)}`;
  const res = await fetch(q);
  if (!res.ok) {
    console.error("[APIFunctions] listDirectory failed", res.status, res.statusText);
    status.textContent = `Failed to load ${pathId}`;
    return { directories: [], files: [] };
  }
  const data = await res.json();
  // expect { directories: [names], files: [names] }
  return data;

}

/**
 * Extracts edges from visible files by calling the server-side batch extraction API.
 * @param {string[]} files - Array of file paths (relative to Notebook) to scan for edges.
 * @returns {Promise<Object<string, string[]>>} Map of source file -> array of target files
 */
export async function extractEdgesFromFiles(files) {
  if (!files || files.length === 0) return {};
  
  try {
    const res = await fetch('/api/extractEdgesBatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    });
    
    if (!res.ok) {
      console.warn("[APIFunctions] extractEdgesBatch failed:", res.status);
      return {};
    }
    
    const data = await res.json();
    return data.edgeMap || {};
  } catch (err) {
    console.error("[APIFunctions] extractEdgesBatch error:", err);
    return {};
  }
}

/**
 * Fetches and resolves all necessary edge buckets for the given list of files.
 * @param {Set<string>} neededBuckets - Set of unique bucket filenames (e.g., "a.json").
 * @returns {Promise<Object<string, {edgesFrom: string[], edgesTo: string[]}>>}
 */
export async function fetchEdgeBuckets(neededBuckets) {
  const bucketList = [...neededBuckets];
  const bucketPromises = bucketList.map(b => fetch(`/api/readEdgeBucket?file=${b}`).then(r => {
    if (!r.ok) {
      console.warn("[APIFunctions] bucket fetch failed:", b, r.status);
      return {};
    }
    return r.json();
  }).catch(err => {
    console.error("[APIFunctions] bucket fetch err", b, err);
    return {};
  }));

  const buckets = await Promise.all(bucketPromises);
  const edgeIndex = Object.create(null); // id -> { edgesFrom, edgesTo }
  for (const bucket of buckets) {
    if (!bucket || typeof bucket !== "object") continue;
    for (const [id, rec] of Object.entries(bucket)) {
      edgeIndex[id] = {
        edgesFrom: (rec.edgesFrom || rec.sources || []).slice(),
        edgesTo: (rec.edgesTo || rec.targets || rec.destinations || []).slice()
      };
    }
  }
  return edgeIndex;
}
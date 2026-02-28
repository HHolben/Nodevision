// Nodevision/public/PanelInstances/InfoPanels/GraphManagerDependencies/EdgeManagement.mjs

import { bucketFileForId, fetchEdgeBuckets, extractEdgesFromFiles } from './APIFunctions.mjs';

/**
 * Finds the nearest visible ancestor node for a given ID.
 * This is crucial for collapsed-edge behavior.
 * @param {string} targetId - The original node ID (may be hidden).
 * @param {Set<string>} visibleSet - Set of all currently visible node IDs.
 * @returns {string | null} The ID of the nearest visible ancestor or the node itself, or null if none is found.
 */
function nearestVisibleAncestor(targetId, visibleSet) {
  // If the target itself is visible, return it.
  if (visibleSet.has(targetId)) return targetId;

  // Walk up path progressively to find closest visible ancestor
  const parts = targetId.split("/");
  for (let i = parts.length - 1; i > 0; i--) {
    const ancestor = parts.slice(0, i).join("/");
    if (visibleSet.has(ancestor)) return ancestor;
  }
  // not found
  return null;
}

/**
 * Extracts the file path from a node ID (removes the Notebook prefix)
 * @param {string} nodeId 
 * @returns {string}
 */
function nodeIdToFilePath(nodeId) {
  return nodeId.startsWith('Notebook/') ? nodeId.replace('Notebook/', '') : nodeId;
}

/**
 * Converts a file path to a node ID (adds Notebook prefix if needed)
 * @param {string} filePath 
 * @returns {string}
 */
function filePathToNodeId(filePath) {
  return filePath.startsWith('Notebook/') ? filePath : `Notebook/${filePath}`;
}

/**
 * Recomputes and renders the aggregated edges based on currently visible nodes.
 * Scans visible file nodes for edges (links, srcs, etc) and renders them.
 * @param {object} params
 * @param {object} params.cy - The Cytoscape instance.
 * @param {HTMLElement} params.status - The status text element.
 */
export async function recomputeEdges({ cy, status }) {
  try {
    status.textContent = "Resolving edges...";
    console.log("[EdgeManagement] recomputeEdges: computing visible nodes");

    // 1. Compute visible nodes
    const visibleNodes = cy.nodes(":visible").map(n => n.id());
    const visibleSet = new Set(visibleNodes);
    
    // 2. Get visible file nodes (not directories) and extract their file paths
    const visibleFileNodes = cy.nodes(":visible").filter(n => n.data("type") === "file");
    const filePaths = visibleFileNodes.map(n => nodeIdToFilePath(n.id()));
    
    console.log("[EdgeManagement] Scanning", filePaths.length, "visible files for edges");

    // 3. Extract edges from visible files dynamically
    const edgeMap = await extractEdgesFromFiles(filePaths);
    console.log("[EdgeManagement] Dynamic edge extraction result:", Object.keys(edgeMap).length, "files have edges");

    // 4. Also fetch pre-computed edge buckets as fallback/supplement
    const neededBuckets = new Set(visibleNodes.map(bucketFileForId));
    const edgeIndex = await fetchEdgeBuckets(neededBuckets);

    // 5. Collect aggregated edges: use a Map keyed by "source|target" to dedupe
    const aggregated = new Map();

    // Add edges from dynamic extraction (links found in file content)
    for (const [sourceFilePath, targetFilePaths] of Object.entries(edgeMap)) {
      const sourceNodeId = filePathToNodeId(sourceFilePath);
      
      // Skip if source node is not visible
      if (!visibleSet.has(sourceNodeId)) continue;
      
      for (const targetFilePath of targetFilePaths) {
        const targetNodeId = filePathToNodeId(targetFilePath);
        const targetEffective = nearestVisibleAncestor(targetNodeId, visibleSet);
        
        if (!targetEffective) continue;
        if (sourceNodeId === targetEffective) continue; // Skip self-loops
        
        const key = `${sourceNodeId}|${targetEffective}`;
        if (!aggregated.has(key)) {
          aggregated.set(key, { 
            data: { 
              id: `e:${sourceNodeId}->${targetEffective}`, 
              source: sourceNodeId, 
              target: targetEffective 
            }
          });
        }
      }
    }

    // Also add edges from pre-computed buckets (outgoing edges)
    for (const srcId of visibleNodes) {
      const rec = edgeIndex[srcId] || { edgesFrom: [], edgesTo: [] };
      const outs = rec.edgesFrom || [];
      for (const rawTarget of outs) {
        const targetEffective = nearestVisibleAncestor(rawTarget, visibleSet);
        if (!targetEffective) continue;
        if (srcId === targetEffective) continue;

        const key = `${srcId}|${targetEffective}`;
        if (!aggregated.has(key)) {
          aggregated.set(key, { data: { id: `e:${srcId}->${targetEffective}`, source: srcId, target: targetEffective }});
        }
      }
    }

    // Also add edges from pre-computed buckets (incoming edges)
    for (const targetId of visibleNodes) {
      const rec = edgeIndex[targetId] || { edgesFrom: [], edgesTo: [] };
      const ins = rec.edgesTo || [];
      for (const rawSource of ins) {
        const sourceEffective = nearestVisibleAncestor(rawSource, visibleSet);
        if (!sourceEffective) continue;
        if (sourceEffective === targetId) continue;

        const key = `${sourceEffective}|${targetId}`;
        if (!aggregated.has(key)) {
          aggregated.set(key, { data: { id: `e:${sourceEffective}->${targetId}`, source: sourceEffective, target: targetId }});
        }
      }
    }

    // 6. Remove existing edges and add new aggregated edges
    cy.batch(() => {
      cy.edges().remove();
      if (aggregated.size > 0) {
        cy.add([...aggregated.values()]);
      }
    });

    console.log("[EdgeManagement] rendered edges:", aggregated.size);
    status.textContent = `Ready — ${cy.nodes(':visible').length} nodes, ${aggregated.size} edges`;
  } catch (err) {
    console.error("[EdgeManagement] recomputeEdges error", err);
    status.textContent = "Edge resolution error (see console)";
  }
}
// Nodevision/public/PanelInstances/InfoPanels/GraphManagerDependencies/EdgeManagement.mjs

import { bucketFileForId, fetchEdgeBuckets } from './APIFunctions.mjs';

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
 * Recomputes and renders the aggregated edges based on currently visible nodes.
 * @param {object} params
 * @param {object} params.cy - The Cytoscape instance.
 * @param {HTMLElement} params.status - The status text element.
 */
export async function recomputeEdges({ cy, status }) {
  try {
    status.textContent = "Resolving edges...";
    console.log("[EdgeManagement] recomputeEdges: computing visible nodes & buckets");

    // 1. Compute visible nodes and needed buckets
    const visibleNodes = cy.nodes(":visible").map(n => n.id());
    const visibleSet = new Set(visibleNodes);
    const neededBuckets = new Set(visibleNodes.map(bucketFileForId));

    // 2. Fetch edge index data
    const edgeIndex = await fetchEdgeBuckets(neededBuckets);
    console.log("[EdgeManagement] edgeIndex size:", Object.keys(edgeIndex).length);

    // 3. Collect aggregated edges: use a Map keyed by "source|target" to dedupe
    const aggregated = new Map();

    // Loop through visible nodes to find outgoing edges
    for (const srcId of visibleNodes) {
      const rec = edgeIndex[srcId] || { edgesFrom: [], edgesTo: [] };
      const outs = rec.edgesFrom || [];
      for (const rawTarget of outs) {
        const targetEffective = nearestVisibleAncestor(rawTarget, visibleSet);
        if (!targetEffective) continue;

        const key = `${srcId}|${targetEffective}`;
        if (!aggregated.has(key)) {
          aggregated.set(key, { data: { id: `e:${srcId}->${targetEffective}`, source: srcId, target: targetEffective }});
        }
      }
    }

    // Loop through visible nodes to find incoming edges
    for (const targetId of visibleNodes) {
      const rec = edgeIndex[targetId] || { edgesFrom: [], edgesTo: [] };
      const ins = rec.edgesTo || [];
      for (const rawSource of ins) {
        const sourceEffective = nearestVisibleAncestor(rawSource, visibleSet);
        if (!sourceEffective) continue;

        const key = `${sourceEffective}|${targetId}`;
        if (!aggregated.has(key)) {
          aggregated.set(key, { data: { id: `e:${sourceEffective}->${targetId}`, source: sourceEffective, target: targetId }});
        }
      }
    }

    // 4. Remove existing edges and add new aggregated edges
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
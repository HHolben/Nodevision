// GraphAddElements.js
// Purpose: TODO: Add description of module purpose

/**
 * Function to add nodes (subNodes) to the graph.
 * @param {Array} subNodes - Array of node objects to add.
 * @param {String} regionId - The ID of the parent region node.
 */
function AddNode(subNodes, regionId) {
  const newElements = subNodes.map(node => ({
    group: 'nodes',
    data: {
      id: node.id,
      label: node.label,
      parent: regionId, // Assign the parent region (compound node)
      type: node.isDirectory ? 'region' : 'node',
      imageUrl: node.imageUrl
    }
  }));

  // Add the sub-nodes within the compound node
  cy.add(newElements);
} // Ends AddNode Function

/**
 * Function to add an edge to the graph.
 * This version checks if the target (or source) node is inside a collapsed region,
 * and if so, rewires the edge to point to the collapsed region instead.
 * @param {String} sourceId - The ID of the source node.
 * @param {String} targetId - The ID of the target node (or link).
 */
function AddEdgeToGraph(sourceId, targetId) {
  // Check if the target node belongs to a region and if that region is collapsed.
  let targetElement = cy.getElementById(targetId);
  if (targetElement.nonempty() && targetElement.data('parent')) {
    // Retrieve the parent (region) node.
    let parentId = targetElement.data('parent');
    let parentElement = cy.getElementById(parentId);
    // If the parent exists and is not expanded (i.e. collapsed), rewire the target.
    if (parentElement.nonempty() && !parentElement.data('expanded')) {
      console.log(`Rewiring edge target from ${targetId} to collapsed region ${parentId}`);
      targetId = parentId;
    }
  }

  // Optionally, check if the source node is inside a collapsed region.
  let sourceElement = cy.getElementById(sourceId);
  if (sourceElement.nonempty() && sourceElement.data('parent')) {
    let parentId = sourceElement.data('parent');
    let parentElement = cy.getElementById(parentId);
    if (parentElement.nonempty() && !parentElement.data('expanded')) {
      console.log(`Rewiring edge source from ${sourceId} to collapsed region ${parentId}`);
      sourceId = parentId;
    }
  }

  // Finally, add the edge with (possibly rewired) source and target IDs.
  cy.add({
    group: 'edges',
    data: {
      id: `${sourceId}_to_${targetId}`,
      source: sourceId,
      target: targetId,
    }
  });
} // Ends AddEdgeToGraph()

/**
 * Function to add a region node (as a compound node) to the graph.
 * By default, the region is marked as collapsed (expanded: false).
 * @param {Object} regionElement - The region element (assumed to be a Cytoscape node)
 *                                 whose data contains the necessary info.
 */
function AddRegionToGraph(regionElement) {
  const regionId = regionElement.id();

  cy.add({
    group: 'nodes',
    data: {
      id: regionId,
      label: regionElement.data('label'),
      type: 'region',
      imageUrl: regionElement.data('imageUrl'),
      parent: regionElement.data('parent'),
      expanded: false  // Default state: collapsed
    }
  });
} // Ends AddRegionToGraph()

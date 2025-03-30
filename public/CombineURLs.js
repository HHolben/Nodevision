function combineURLs(baseURL, additionalPath) 
{
  // Remove everything after the last "/" in baseURL to get the base directory path
  let basePath = baseURL.substring(0, baseURL.lastIndexOf('/') + 1);
  const baseSegments = basePath.split('/').filter(Boolean);
  const additionalSegments = additionalPath.split('/');

  // Build the combined URL path by handling relative path segments ("../" and "./")
  additionalSegments.forEach(segment => {
      if (segment === "..") {
          baseSegments.pop(); // Go up one directory level
      } else if (segment !== "." && segment !== "") {
          baseSegments.push(segment); // Add valid segments
      }
  });

  // Construct the final combined path
  let resolvedPath = baseSegments.join('/');

  // Check if this resolved path exists as a node in Cytoscape
  if (!cy.getElementById(resolvedPath).length) {
      // If not found, iteratively search upwards for the nearest loaded directory node
      while (baseSegments.length > 0) {
          // Move up to the next higher directory level
          baseSegments.pop();
          const parentPath = baseSegments.join('/');
          
          // Check if this parent path exists in the graph as a collapsed region
          const parentNode = cy.getElementById(parentPath);
          if (parentNode && parentNode.data('type') === 'region') {
              return parentPath; // Return the path to the nearest collapsed region
          }
      }

      // If no parent region is found, fallback to the base URL itself
      return baseURL;
  }

  return resolvedPath; // Return the resolved path if found as a node
}

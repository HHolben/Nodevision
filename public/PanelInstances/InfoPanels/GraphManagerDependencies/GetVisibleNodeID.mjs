//Nodevision/public/PanelInstances/InfoPanels/GraphManagerDependencies/GetVisibleNodeID.mjs


/**
 * Finds the highest visible element in the hierarchy for a given path.
 * If the target file is nested inside a directory that is currently 
 * collapsed (removed from the graph), it returns the closest visible parent.
 */
import { normalizePath } from './NormalizePath.mjs';

export function getVisibleNodeId(cy, fullPath) {
    console.log("Getting the visible node ID for "+ fullPath);
    const cleanPath = normalizePath(fullPath);
    console.log("clean Path"+cleanPath);
    // 1. Check if the specific target node exists in the graph
    const exactNode = cy.getElementById(cleanPath);
    if (!exactNode.empty()) {
        return cleanPath; // Success! The file is "open" or visible.
    }

    // 2. If the file isn't found, find the closest visible ancestor
    const parts = cleanPath.split('/');
    // Start from the immediate parent and go up to the root
    for (let i = parts.length - 1; i > 0; i--) {
        const parentPath = parts.slice(0, i).join('/');
        const parentNode = cy.getElementById(parentPath);
        
        if (!parentNode.empty()) {
            return parentPath;
        }
    }

    // 3. No visible anchor found (likely invalid/non-existent target)
    return null;
}

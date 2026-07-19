// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/ScanForLinks.mjs
// Browser-side link scanner for graph edge discovery.

import { scanFileForLinkRecords } from "./LinkRecords.mjs";

/**
 * Scans file content for links based on extension.
 * Returns an array of discovered raw links for older Graph Manager callers.
 */
export async function scanFileForLinks(fullPath) {
    const records = await scanFileForLinkRecords(fullPath);
    const links = [...new Set(records.map((record) => record.targetRaw).filter(Boolean))];
    if (links.length > 0) {
        console.log(`[Scanner] Links found in ${fullPath}:`, links);
    }
    return links;
}

export { scanFileForLinkRecords };

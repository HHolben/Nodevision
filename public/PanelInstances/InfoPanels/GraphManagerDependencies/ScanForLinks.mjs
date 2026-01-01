//Nodevision/public/PanelInstances/InfoPanels/GraphManagerDependencies/ScanForLinks.mjs
/**
 * Scans file content for hyperlinks based on extension
 * Returns an array of discovered links
 */
export async function scanFileForLinks(fullPath) {
    const ext = fullPath.split('.').pop().toLowerCase();
    if (ext !== 'html' && ext !== 'md') return [];

    try {
        const response = await fetch(`/Notebook/${fullPath}`);
        if (!response.ok) {
            console.warn(`⚠️ Scanner could not reach file: ${fullPath}`);
            return [];
        }
        
        // Use .text() for raw html/md content
        const text = await response.text();

        let links = [];
        if (ext === 'html') {
            // Match href attributes in anchors
            const htmlRegex = /href=["']([^"']+)["']/g;
            links = [...text.matchAll(htmlRegex)].map(match => match[1]);
        } else if (ext === 'md') {
            // Match Markdown style links [text](link)
            const mdRegex = /\[(?:[^\]]+)\]\(([^)]+)\)/g;
            links = [...text.matchAll(mdRegex)].map(match => match[1]);
        }

        if (links.length > 0) {
            console.log(`🔗 [Scanner] Links found in ${fullPath}:`, links);
        }
        
        return links;
    } catch (err) {
        console.warn(`❌ Error scanning ${fullPath}:`, err);
        return [];
    }
}
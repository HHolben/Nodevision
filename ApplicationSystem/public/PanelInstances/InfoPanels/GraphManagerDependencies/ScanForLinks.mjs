// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/ScanForLinks.mjs
// Browser-side link scanner for graph edge discovery.

function shouldIgnoreLink(rawLink) {
    const link = String(rawLink || "").trim();
    if (!link) return true;
    if (link.startsWith("#")) return true;
    if (/^(data|javascript|mailto|file):/i.test(link)) return true;
    if (/^\/\//.test(link)) return true;
    return false;
}

function dedupeLinks(links) {
    const seen = new Set();
    const out = [];
    for (const raw of links) {
        const link = String(raw || "").trim();
        if (shouldIgnoreLink(link) || seen.has(link)) continue;
        seen.add(link);
        out.push(link);
    }
    return out;
}

function extractHtmlLinks(text) {
    const links = [];
    const attrRegex = /(?:href|src|data-nodevision-font-src|data-nodevision-font-stylesheet)\s*=\s*(["'])(.*?)\1/gi;
    for (const match of text.matchAll(attrRegex)) {
        links.push(match[2]);
    }

    const cssUrlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'"\)]+))\s*\)/gi;
    for (const match of text.matchAll(cssUrlRegex)) {
        links.push(match[1] || match[2] || match[3]);
    }

    // External http(s) font URLs are preserved here. TODO: create explicit
    // external URL nodes when the graph model supports them.
    return dedupeLinks(links);
}

function extractMarkdownLinks(text) {
    const links = [];
    const mdRegex = /\[(?:[^\]]+)\]\(([^)]+)\)/g;
    for (const match of text.matchAll(mdRegex)) {
        links.push(match[1]);
    }
    return dedupeLinks(links);
}

/**
 * Scans file content for links based on extension.
 * Returns an array of discovered links.
 */
export async function scanFileForLinks(fullPath) {
    const ext = fullPath.split('.').pop().toLowerCase();
    if (ext !== 'html' && ext !== 'md') return [];

    try {
        const response = await fetch(`/Notebook/${fullPath}`);
        if (!response.ok) {
            console.warn(`Scanner could not reach file: ${fullPath}`);
            return [];
        }
        
        const text = await response.text();
        const links = ext === 'html' ? extractHtmlLinks(text) : extractMarkdownLinks(text);

        if (links.length > 0) {
            console.log(`[Scanner] Links found in ${fullPath}:`, links);
        }
        
        return links;
    } catch (err) {
        console.warn(`Error scanning ${fullPath}:`, err);
        return [];
    }
}

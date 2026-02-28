// Nodevision/public/Graph/LinkExtractor.mjs
// Extracts links from files to create edges in the graph

import fs from 'fs/promises';
import path from 'path';

// Extract links from different file types
export async function extractLinksFromFile(filePath, sourceNodeId) {
  const ext = path.extname(filePath).toLowerCase();
  const edges = [];

  try {
    const content = await fs.readFile(filePath, 'utf8');

    if (['.html', '.htm'].includes(ext)) {
      const htmlEdges = extractFromHTML(content, sourceNodeId);
      edges.push(...htmlEdges);
    } else if (ext === '.md') {
      const mdEdges = extractFromMarkdown(content, sourceNodeId);
      edges.push(...mdEdges);
    } else if (['.txt', '.csv'].includes(ext)) {
      const textEdges = extractFromPlainText(content, sourceNodeId);
      edges.push(...textEdges);
    }
    // Add more formats as needed
  } catch (err) {
    console.warn(`[LinkExtractor] Could not read ${filePath}: ${err.message}`);
  }

  return edges;
}

// Extract links from HTML content
function extractFromHTML(content, sourceNodeId) {
  const edges = [];
  // Match href attributes
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(content)) !== null) {
    const href = match[1];
    const destination = normalizeLink(href);
    if (destination) {
      edges.push({
        source: sourceNodeId,
        destination,
        type: 'link',
        context: 'html-href'
      });
    }
  }

  return edges;
}

// Extract links from Markdown content
function extractFromMarkdown(content, sourceNodeId) {
  const edges = [];
  
  // Match [text](link) pattern
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = mdLinkRegex.exec(content)) !== null) {
    const destination = normalizeLink(match[2]);
    if (destination) {
      edges.push({
        source: sourceNodeId,
        destination,
        type: 'link',
        context: 'markdown-link'
      });
    }
  }

  return edges;
}

// Extract links from plain text (simple URL detection)
function extractFromPlainText(content, sourceNodeId) {
  const edges = [];
  
  // Match URLs and file paths
  const urlRegex = /(https?:\/\/[^\s]+|\.\/[^\s]+|\.\.\/[^\s]+|[a-zA-Z0-9_\-./]+\.(html|htm|md|txt|csv))/g;
  let match;

  while ((match = urlRegex.exec(content)) !== null) {
    const destination = normalizeLink(match[1]);
    if (destination && !destination.startsWith('http')) {
      edges.push({
        source: sourceNodeId,
        destination,
        type: 'link',
        context: 'plaintext-url'
      });
    }
  }

  return edges;
}

// Normalize link to notebook-relative path
function normalizeLink(link) {
  if (!link || typeof link !== 'string') return null;

  // Skip external links
  if (link.startsWith('http://') || link.startsWith('https://')) return null;

  // Remove anchors
  link = link.split('#')[0];

  // Normalize path separators
  link = link.replace(/\\/g, '/');

  // Remove leading/trailing whitespace
  link = link.trim();

  // Skip empty or relative parent paths
  if (!link || link === '.' || link === '..') return null;

  return link;
}

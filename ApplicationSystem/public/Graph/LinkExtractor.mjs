// Nodevision/ApplicationSystem/public/Graph/LinkExtractor.mjs
// This file defines browser-side Link Extractor logic for the Nodevision UI. It renders interface components and handles user interactions.

import fs from 'fs/promises';
import path from 'path';
import { resolveNotebookReference } from '../utils/notebookPath.mjs';

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
  const attrRegex = new RegExp("\\b(href|src|data-src|data-nodevision-image-src|data-nodevision-citation-source|data-nodevision-font-src|data-nodevision-font-stylesheet|data-nodevision-circuit-src|data-nodevision-fallback-(\\d+))\\s*=\\s*[\"\\x27]([^\"\\x27]+)[\"\\x27]", "gi");
  let match;

  while ((match = attrRegex.exec(content)) !== null) {
    const attrName = String(match[1] || "").toLowerCase();
    const destination = normalizeLink(match[3], sourceNodeId);
    if (!destination) continue;
    const isFallback = attrName.startsWith("data-nodevision-fallback-");
    edges.push({
      source: sourceNodeId,
      destination,
      type: "link",
      context: isFallback ? "html-fallback" : "html-attribute",
      referenceRole: isFallback ? "fallback" : "primary",
      fallbackPriority: Number(match[2] || 0),
    });
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
    const destination = normalizeLink(match[2], sourceNodeId);
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
    const destination = normalizeLink(match[1], sourceNodeId);
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

// Resolve a stored link against the source document directory.
function normalizeLink(link, sourcePath = "") {
  return resolveNotebookReference({ sourcePath, reference: link });
}

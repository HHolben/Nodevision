// Nodevision/routes/api/scanNotebook.js
// Fast, responsive Notebook scanning

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTEBOOK_DIR = path.join(__dirname, '../../Notebook');
const router = express.Router();

const MAX_ITEMS = 50; // max files/directories returned per request

// Helper: extract [[wiki-links]] from file content
function extractLinks(content) {
  const links = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) links.push(match[1]);
  return links;
}

function pathToId(filePath) {
  return filePath.replace(/\.md$/, '');
}

// Recursive scan with optional maxDepth
async function scanDirectory(dirPath, relativePath = '', depth = 0, maxDepth = 1) {
  let allFiles = [];
  let allDirs = [];

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      allDirs.push({
        id: relPath,
        label: entry.name,
        type: 'directory',
        path: relPath,
        parent: relativePath || null
      });

      if (depth < maxDepth) {
        const subResults = await scanDirectory(fullPath, relPath, depth + 1, maxDepth);
        allFiles.push(...subResults.allFiles);
        allDirs.push(...subResults.allDirs);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const content = await fs.readFile(fullPath, 'utf-8');
      const links = extractLinks(content);
      allFiles.push({
        id: pathToId(relPath),
        label: entry.name.replace(/\.md$/, ''),
        type: 'file',
        path: relPath,
        parent: relativePath || null,
        links
      });
    }
  }

  return { allFiles, allDirs };
}

// Build a top-level graph (only top-level nodes)
function buildTopLevelGraph(allFiles, allDirs) {
  const nodes = [];
  const edges = [];

  const fileMap = new Map();
  for (const file of allFiles) fileMap.set(file.id, file);

  const topFiles = allFiles.filter(f => !f.parent).slice(0, MAX_ITEMS);
  const topDirs = allDirs.filter(d => !d.parent).slice(0, MAX_ITEMS);

  for (const file of topFiles) nodes.push({ ...file });
  for (const dir of topDirs) nodes.push({ ...dir, hasChildren: true });

  for (const file of topFiles) {
    if (file.links) {
      for (const link of file.links) {
        const target = fileMap.get(link) || fileMap.get(pathToId(link));
        if (target && topFiles.find(f => f.id === target.id)) {
          edges.push({ id: `${file.id}->${target.id}`, source: file.id, target: target.id });
        }
      }
    }
  }

  return { nodes, edges };
}

// Return contents of a specific directory
function getDirectoryContents(dirPath, allFiles, allDirs) {
  const nodes = [];
  const edges = [];

  const fileMap = new Map();
  for (const file of allFiles) fileMap.set(file.id, fileMap);

  const childFiles = allFiles.filter(f => f.parent === dirPath).slice(0, MAX_ITEMS);
  const childDirs = allDirs.filter(d => d.parent === dirPath).slice(0, MAX_ITEMS);

  for (const f of childFiles) nodes.push({ ...f });
  for (const d of childDirs) nodes.push({ ...d, hasChildren: true });

  for (const file of childFiles) {
    if (file.links) {
      for (const link of file.links) {
        const target = fileMap.get(link) || fileMap.get(pathToId(link));
        if (target) edges.push({ id: `${file.id}->${target.id}`, source: file.id, target: target.id });
      }
    }
  }

  return { nodes, edges, hasMore: childFiles.length + childDirs.length > MAX_ITEMS };
}

router.get('/scanNotebook', async (req, res) => {
  console.log('[scanNotebook] Request received');
  try {
    const { directory } = req.query;
    console.log('[scanNotebook] Directory param:', directory);

    let maxDepth = directory ? Infinity : 1;
    const { allFiles, allDirs } = await scanDirectory(NOTEBOOK_DIR, '', 0, maxDepth);
    console.log('[scanNotebook] Scan complete. Files:', allFiles.length, 'Dirs:', allDirs.length);

    if (directory) {
      const data = getDirectoryContents(directory, allFiles, allDirs);
      res.json(data);
    } else {
      const graph = buildTopLevelGraph(allFiles, allDirs);
      res.json(graph);
    }
  } catch (err) {
    console.error('[scanNotebook] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

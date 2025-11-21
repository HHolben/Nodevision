// Nodevision/routes/api/scanNotebook.js
// Scans the Notebook directory and generates graph data

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTEBOOK_DIR = path.join(__dirname, '../../Notebook');
const router = express.Router();

/**
 * Parse file content to find [[wiki-style links]]
 */
function extractLinks(content) {
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }
  
  return links;
}

/**
 * Normalize file path to ID (remove .md extension)
 */
function pathToId(filePath) {
  return filePath.replace(/\.md$/, '');
}

/**
 * Recursively scan directory and collect all files and directories
 */
async function scanDirectory(dirPath, relativePath = '') {
  const allFiles = [];
  const allDirs = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        // Add directory
        allDirs.push({
          id: relPath,
          label: entry.name,
          type: 'directory',
          path: relPath,
          parent: relativePath || null
        });
        
        // Recursively scan subdirectory
        const subResults = await scanDirectory(fullPath, relPath);
        allFiles.push(...subResults.allFiles);
        allDirs.push(...subResults.allDirs);
        
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const links = extractLinks(content);
        
        allFiles.push({
          id: pathToId(relPath),
          label: entry.name.replace(/\.md$/, ''),
          type: 'file',
          path: relPath,
          parent: relativePath || null,
          links: links
        });
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dirPath}:`, err);
  }
  
  return { allFiles, allDirs };
}

/**
 * Build nodes and edges for top-level view
 */
function buildTopLevelGraph(allFiles, allDirs) {
  const nodes = [];
  const edges = [];
  
  // Create a map for quick file lookup
  const fileMap = new Map();
  for (const file of allFiles) {
    fileMap.set(file.id, file);
    fileMap.set(file.label, file); // Also by label
  }
  
  // Add top-level files (parent is null or empty)
  for (const file of allFiles) {
    if (!file.parent || file.parent === '') {
      nodes.push({
        id: file.id,
        label: file.label,
        type: 'file',
        path: file.path
      });
    }
  }
  
  // Add top-level directories (parent is null or empty)
  for (const dir of allDirs) {
    if (!dir.parent || dir.parent === '') {
      nodes.push({
        id: dir.id,
        label: dir.label,
        type: 'directory',
        path: dir.path,
        hasChildren: true
      });
    }
  }
  
  // Build edges only between top-level nodes
  const topLevelIds = new Set(nodes.map(n => n.id));
  
  for (const file of allFiles) {
    if (file.links && topLevelIds.has(file.id)) {
      for (const link of file.links) {
        const target = fileMap.get(link) || fileMap.get(pathToId(link));
        if (target && topLevelIds.has(target.id)) {
          edges.push({
            id: `${file.id}->${target.id}`,
            source: file.id,
            target: target.id
          });
        }
      }
    }
  }
  
  return { nodes, edges };
}

/**
 * Get contents of a specific directory
 */
function getDirectoryContents(dirPath, allFiles, allDirs) {
  const nodes = [];
  const edges = [];
  
  // Create file map for link resolution
  const fileMap = new Map();
  for (const file of allFiles) {
    fileMap.set(file.id, file);
    fileMap.set(file.label, file);
  }
  
  // Find immediate children of this directory
  for (const file of allFiles) {
    if (file.parent === dirPath) {
      nodes.push({
        id: file.id,
        label: file.label,
        type: 'file',
        path: file.path,
        parent: dirPath
      });
    }
  }
  
  for (const dir of allDirs) {
    if (dir.parent === dirPath) {
      nodes.push({
        id: dir.id,
        label: dir.label,
        type: 'directory',
        path: dir.path,
        parent: dirPath,
        hasChildren: true
      });
    }
  }
  
  // Build edges for these nodes
  for (const file of allFiles) {
    if (file.links && file.parent === dirPath) {
      for (const link of file.links) {
        const target = fileMap.get(link) || fileMap.get(pathToId(link));
        if (target) {
          edges.push({
            id: `${file.id}->${target.id}`,
            source: file.id,
            target: target.id
          });
        }
      }
    }
  }
  
  return { nodes, edges };
}

router.get('/scanNotebook', async (req, res) => {
  console.log('[scanNotebook] Request received');
  try {
    const { directory } = req.query;
    console.log('[scanNotebook] Directory query param:', directory);
    
    console.log('[scanNotebook] Starting directory scan...');
    // Scan entire notebook to get all files and dirs
    const { allFiles, allDirs } = await scanDirectory(NOTEBOOK_DIR);
    console.log('[scanNotebook] Scan complete. Files:', allFiles.length, 'Dirs:', allDirs.length);
    
    if (directory) {
      // Return contents of specific directory
      console.log('[scanNotebook] Getting directory contents for:', directory);
      const data = getDirectoryContents(directory, allFiles, allDirs);
      console.log('[scanNotebook] Sending response');
      res.json(data);
    } else {
      // Return top-level structure
      console.log('[scanNotebook] Building top-level graph');
      const graph = buildTopLevelGraph(allFiles, allDirs);
      console.log('[scanNotebook] Sending response with', graph.nodes.length, 'nodes');
      res.json(graph);
    }
  } catch (err) {
    console.error('[scanNotebook] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

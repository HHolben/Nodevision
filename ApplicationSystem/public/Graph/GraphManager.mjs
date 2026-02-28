// Nodevision/public/Graph/GraphManager.mjs
// Core Graph Manager: generates and manages graph data
// Output: nodes/ and edges/by-destination/ in this directory

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractLinksFromFile } from './LinkExtractor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

// Paths
const NOTEBOOK_DIR = path.join(ROOT_DIR, 'Notebook');
const NODES_DIR = path.join(__dirname, 'nodes');
const EDGES_DEST_DIR = path.join(__dirname, 'edges/by-destination');

// Helper: Get first character bucket (case-sensitive)
function getCharBucket(name) {
  const ch = name.charAt(0);
  if (/^[A-Za-z0-9]$/.test(ch)) return ch;
  return '_symbols';
}

// Ensure output directories exist
async function ensureDirectories() {
  await fs.mkdir(NODES_DIR, { recursive: true });
  await fs.mkdir(EDGES_DEST_DIR, { recursive: true });
}

// Clear old graph files
async function clearOldFiles() {
  for (const dir of [NODES_DIR, EDGES_DEST_DIR]) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(dir, file));
        }
      }
    } catch (err) {
      // Directory may not exist yet
    }
  }
}

// Traverse notebook and collect nodes and edges
async function traverseNotebook() {
  const nodesByChar = {}; // { char: [nodeData, ...] }
  const edgesByDestChar = {}; // { char: [edgeData, ...] }

  async function traverse(dir, relativePath = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      const nodeId = relPath; // Use relative path as node ID
      const char = getCharBucket(entry.name);

      // Create node entry
      const nodeEntry = {
        id: nodeId,
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: relPath
      };

      // Collect nodes by character
      if (!nodesByChar[char]) nodesByChar[char] = [];
      nodesByChar[char].push(nodeEntry);

      // Extract edges from files
      if (entry.isFile()) {
        try {
          const edges = await extractLinksFromFile(fullPath, nodeId);
          for (const edge of edges) {
            const destChar = getCharBucket(edge.destination);
            if (!edgesByDestChar[destChar]) edgesByDestChar[destChar] = [];
            edgesByDestChar[destChar].push(edge);
          }
        } catch (err) {
          console.warn(`[GraphManager] Failed to extract links from ${relPath}:`, err.message);
        }
      }

      // Recurse into directories
      if (entry.isDirectory()) {
        await traverse(fullPath, relPath);
      }
    }
  }

  await traverse(NOTEBOOK_DIR);
  return { nodesByChar, edgesByDestChar };
}

// Write JSON files for nodes
async function writeNodeFiles(nodesByChar) {
  for (const [char, nodes] of Object.entries(nodesByChar)) {
    const filename = `${char}.json`;
    const filePath = path.join(NODES_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(nodes, null, 2));
    console.log(`[GraphManager] Wrote nodes: ${filename} (${nodes.length} nodes)`);
  }
}

// Write JSON files for edges by destination
async function writeEdgesByDestinationFiles(edgesByDestChar) {
  for (const [char, edges] of Object.entries(edgesByDestChar)) {
    const filename = `${char}.json`;
    const filePath = path.join(EDGES_DEST_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(edges, null, 2));
    console.log(`[GraphManager] Wrote edges by-destination: ${filename} (${edges.length} edges)`);
  }
}

// Main generate function
export async function generateGraph() {
  try {
    console.log('[GraphManager] Starting graph generation...');
    
    await ensureDirectories();
    await clearOldFiles();

    const { nodesByChar, edgesByDestChar } = await traverseNotebook();

    await writeNodeFiles(nodesByChar);
    await writeEdgesByDestinationFiles(edgesByDestChar);

    const totalNodes = Object.values(nodesByChar).reduce((sum, arr) => sum + arr.length, 0);
    const totalEdges = Object.values(edgesByDestChar).reduce((sum, arr) => sum + arr.length, 0);

    console.log(`[GraphManager] Graph generated: ${totalNodes} nodes, ${totalEdges} edges`);
    return { success: true, nodes: totalNodes, edges: totalEdges };
  } catch (err) {
    console.error('[GraphManager] Generation failed:', err);
    throw err;
  }
}

// API: Get nodes by first character
export async function getNodesByCharacter(char) {
  const filename = `${char}.json`;
  const filePath = path.join(NODES_DIR, filename);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// API: Get edges by destination character
export async function getEdgesByDestinationCharacter(char) {
  const filename = `${char}.json`;
  const filePath = path.join(EDGES_DEST_DIR, filename);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// API: Get all edges pointing to a specific node
export async function getEdgesPointingToNode(nodeId) {
  const char = getCharBucket(nodeId);
  const edges = await getEdgesByDestinationCharacter(char);
  return edges.filter(edge => edge.destination === nodeId);
}

// API: Get a specific node by ID
export async function getNode(nodeId) {
  const char = getCharBucket(nodeId);
  const nodes = await getNodesByCharacter(char);
  return nodes.find(node => node.id === nodeId) || null;
}

// For CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  generateGraph().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

// Nodevision/Graph/generateGraphData.js
// Purpose: TODO: Add description of module purpose

// Nodevision/scripts/GenerateGraphFiles.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const NOTEBOOK_DIR = path.resolve(__dirname, '../Notebook');
const DATA_DIR = path.resolve(__dirname, '../public/data');
const NODES_DIR = path.join(DATA_DIR, 'Nodes');
const EDGES_DIR = path.join(DATA_DIR, 'Edges');

// Helpers
function getInitialChar(name) {
  const ch = name.charAt(0) || '_';
  return /^[A-Za-z0-9]$/.test(ch) ? ch : '_';
}
function hashId(str) {
  return crypto.createHash('sha1').update(str).digest('hex');
}

// Ensure directories exist
async function ensureDirs() {
  await fs.mkdir(NODES_DIR, { recursive: true });
  await fs.mkdir(EDGES_DIR, { recursive: true });
}

// Clear old files
async function clearOld() {
  for (const dir of [NODES_DIR, EDGES_DIR]) {
    for (const file of await fs.readdir(dir)) {
      if (/^Nodes_|^EdgesFrom_|^EdgesTo_/.test(file)) {
        await fs.unlink(path.join(dir, file));
      }
    }
  }
}

// Write JSON file
async function writeJson(dir, filename, data) {
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Main generator
async function generate() {
  await ensureDirs();
  await clearOld();

  const nodesByChar = {};
  const edgesFromByChar = {};
  const edgesToByChar = {};

  async function traverse(dir, parentRel = null) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(NOTEBOOK_DIR, full);
      const id = hashId(rel);
      const type = entry.isDirectory() ? 'directory' : 'file';

      // Node
      const char = getInitialChar(entry.name);
      nodesByChar[char] = nodesByChar[char] || [];
      nodesByChar[char].push({ id, name: entry.name, path: rel, type });

      // Edge to parent
      if (parentRel !== null) {
        const parentId = hashId(parentRel);
        // from parent
        edgesFromByChar[getInitialChar(path.basename(parentRel))] = edgesFromByChar[getInitialChar(path.basename(parentRel))] || [];
        edgesFromByChar[getInitialChar(path.basename(parentRel))].push({ source: parentId, target: id });
        // to parent
        edgesToByChar[getInitialChar(path.basename(parentRel))] = edgesToByChar[getInitialChar(path.basename(parentRel))] || [];
        edgesToByChar[getInitialChar(path.basename(parentRel))].push({ source: id, target: parentId });
      }

      if (entry.isDirectory()) {
        await traverse(full, rel);
      }
    }
  }

  await traverse(NOTEBOOK_DIR);

  // Write node files
  for (const [char, nodes] of Object.entries(nodesByChar)) {
    await writeJson(NODES_DIR, `Nodes_${char}.json`, nodes);
  }
  // Write edges files
  for (const [char, edges] of Object.entries(edgesFromByChar)) {
    await writeJson(EDGES_DIR, `EdgesFrom_${char}.json`, edges);
  }
  for (const [char, edges] of Object.entries(edgesToByChar)) {
    await writeJson(EDGES_DIR, `EdgesTo_${char}.json`, edges);
  }

  console.log('Graph files generated:', {
    nodes: Object.keys(nodesByChar).length,
    edgesFrom: Object.keys(edgesFromByChar).length,
    edgesTo: Object.keys(edgesToByChar).length
  });
}

generate().catch(err => console.error('Generation error:', err));

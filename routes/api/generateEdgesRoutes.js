// routes/api/generateEdgesRoutes.js
// Purpose: TODO: Add description of module purpose
import express from 'express';
const router = express.Router();
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import * as cheerio from 'cheerio';

const notebookDir = path.join(__dirname, '../../Notebook');

// Recursively get all allowed files in the Notebook directory.
async function getAllFiles(dir) {
  let files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath);
      files = files.concat(subFiles);
    } else {
        files.push(fullPath);
      
    }
  }
  return files;
}

// Extract hyperlinks from file content using Cheerio.
function extractHyperlinksFromContent(content) {
  const $ = cheerio.load(content);
  const links = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    // Only consider relative links.
    if (href && !href.startsWith('http') && !href.startsWith('//')) {
      links.push(href);
    }
  });
  return links;
}

// Generate edges by scanning all files and extracting links.
async function generateEdges() {
  console.log("Generating edges...");
  const allFiles = await getAllFiles(notebookDir);
  console.log("Found files:", allFiles);
  let edges = [];

  for (const filePath of allFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const links = extractHyperlinksFromContent(content);
      console.log(`File: ${filePath}`);
      console.log("Extracted links:", links);
      
      // Get the file's path relative to Notebook
      const relativeSource = path.relative(notebookDir, filePath).split(path.sep).join('/');
      
      for (const link of links) {
        // Resolve the target path relative to the current file's directory.
        const targetPath = path.resolve(path.dirname(filePath), link);
        // Ensure the target is within the Notebook directory.
        if (targetPath.startsWith(notebookDir)) {
          try {
            await fs.access(targetPath);
            const relativeTarget = path.relative(notebookDir, targetPath).split(path.sep).join('/');
            // Only add an edge if the source and target are different.
            if (relativeSource !== relativeTarget) {
              console.log(`Edge found: ${relativeSource} -> ${relativeTarget}`);
              edges.push({ source: relativeSource, target: relativeTarget });
            }
          } catch (err) {
            console.warn(`Target file ${targetPath} does not exist.`);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing file ${filePath}:`, err);
    }
  }

  console.log("Generated edges:", edges);
  return edges;
}

// Endpoint to generate edges.
router.post('/generateEdges', async (req, res) => {
  try {
    const edges = await generateEdges();
    res.status(200).json({ message: 'Edges generated successfully', edges });
  } catch (error) {
    console.error('Error generating edges:', error);
    res.status(500).send('Failed to generate edges');
  }
});

export default router;

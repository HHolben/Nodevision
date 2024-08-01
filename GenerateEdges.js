const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Maximum edges to display
let MaximumEdgesDisplayed = 10; // Default value, can be adjusted via index.html

// Function to get top-level files
function getTopLevelFiles(dirPath) {
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    return files
      .filter(file => !file.isDirectory())
      .map(file => path.join(dirPath, file.name));
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

// Function to extract edges from HTML files
function extractEdgesFromHTML(filePath, validNodeIds) {
  const htmlContent = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(htmlContent);
  const edges = [];

  $('a').each((index, element) => {
    const href = $(element).attr('href');
    if (href) {
      const source = path.relative(notebookDir, filePath);
      const target = path.relative(notebookDir, path.join(path.dirname(filePath), href));
      const sourceId = source.replace(/\\/g, '/');
      const targetId = target.replace(/\\/g, '/');

      if (validNodeIds.has(targetId)) {
        const edgeId = `${sourceId}_${index}`;
        edges.push({
          data: {
            id: edgeId,
            source: sourceId,
            target: targetId
          }
        });
      }
    }
  });

  return edges;
}

// Function to generate edges from top-level files
function generateEdgesFromTopLevelFiles(dirPath, validNodeIds) {
  const topLevelFiles = getTopLevelFiles(dirPath);
  let edges = [];

  topLevelFiles
    .filter(file => ['.html', '.php', '.js', '.py'].includes(path.extname(file)))
    .forEach(file => {
      const newEdges = extractEdgesFromHTML(file, validNodeIds);
      edges = edges.concat(newEdges);
    });

  return edges.slice(0, MaximumEdgesDisplayed);
}

// Main function to write edges to file
function writeEdgesToFile(dirPath, outputFilePath, validNodeIds) {
  const edges = generateEdgesFromTopLevelFiles(dirPath, validNodeIds);
  const edgesFileContent = `var edges = [\n${edges.map(edge => JSON.stringify(edge)).join(',\n')}\n];\n`;

  fs.writeFileSync(outputFilePath, edgesFileContent, 'utf8');
  console.log(`Generated edges have been written to ${outputFilePath}`);
}

// Load nodes from GeneratedNodes.js
const nodesFilePath = path.join(__dirname, 'public', 'GeneratedNodes.js');
let nodes;
try {
  const nodesFileContent = fs.readFileSync(nodesFilePath, 'utf8');
  const nodesScript = nodesFileContent.substring(nodesFileContent.indexOf('['), nodesFileContent.lastIndexOf(']') + 1);
  nodes = JSON.parse(nodesScript);
} catch (error) {
  console.error('Error loading or parsing nodes:', error);
  process.exit(1);
}

if (!nodes || !Array.isArray(nodes)) {
  console.error('Nodes are not in expected format');
  process.exit(1);
}

const validNodeIds = new Set(nodes.map(node => node.data.id));

// Paths
const notebookDir = path.join(__dirname, 'Notebook');
const outputFilePath = path.join(__dirname, 'public', 'GeneratedEdges.js');

// Generate and write edges to file
writeEdgesToFile(notebookDir, outputFilePath, validNodeIds);

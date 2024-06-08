const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Function to recursively get all files in a directory
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });

  return arrayOfFiles;
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

      console.log(`Processing link: source=${sourceId}, target=${targetId}`); // Debugging log

      if (validNodeIds.has(targetId)) {
        const edgeId = `${sourceId}_${index}`;
        edges.push({
          data: {
            id: edgeId,
            source: sourceId,
            target: targetId
          }
        });
        console.log(`Edge added: ${edgeId}`); // Debugging log
      } else {
        console.log(`Target node not found: ${targetId}`); // Debugging log
      }
    }
  });

  return edges;
}

// Function to generate edges from files
function generateEdgesFromFiles(dirPath, validNodeIds) {
  const allFiles = getAllFiles(dirPath);
  let edges = [];

  allFiles
    .filter(file => ['.html', '.php', '.js', '.py'].includes(path.extname(file)))
    .forEach(file => {
      const newEdges = extractEdgesFromHTML(file, validNodeIds);
      edges = edges.concat(newEdges);
    });

  return edges;
}

// Main function to write edges to file
function writeEdgesToFile(dirPath, outputFilePath, validNodeIds) {
  const edges = generateEdgesFromFiles(dirPath, validNodeIds);
  const edgesFileContent = `var edges = ${JSON.stringify(edges, null, 2)};\n`;

  fs.writeFileSync(outputFilePath, edgesFileContent, 'utf8');
  console.log(`Generated edges have been written to ${outputFilePath}`);
}

// Load nodes from GeneratedNodes.js
const nodesFilePath = path.join(__dirname, 'public', 'GeneratedNodes.js');
let nodes;
try {
  const nodesFileContent = fs.readFileSync(nodesFilePath, 'utf8');
  const nodesScript = nodesFileContent.substring(nodesFileContent.indexOf('=') + 1).trim();
  nodes = JSON.parse(nodesScript.replace(/;\s*$/, ''));
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

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Maximum edges to display
let MaximumEdgesDisplayed = 10; // Default value, can be adjusted via index.html

const notebookDir = path.join(__dirname, 'Notebook');
const generatedEdgesPath = path.join(__dirname, 'public', 'GeneratedEdges.js');

const allowedExtensions = ['.html', '.php', '.js', '.py'];

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

function generateEdges(dir, validNodeIds) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let edges = [];

  entries.forEach(entry => {
    if (entry.isFile() && allowedExtensions.includes(path.extname(entry.name))) {
      const filePath = path.join(dir, entry.name);
      const newEdges = extractEdgesFromHTML(filePath, validNodeIds);
      edges = edges.concat(newEdges);
    }
  });

  return edges.slice(0, MaximumEdgesDisplayed); // Limit the number of edges
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

const edges = generateEdges(notebookDir, validNodeIds);
const edgesOutput = `// GeneratedEdges.js\nconst edges = [\n${edges.map(edge => JSON.stringify(edge)).join(',\n')}\n];\n`;

fs.writeFileSync(generatedEdgesPath, edgesOutput, 'utf8');
console.log(`Generated edges have been written to ${generatedEdgesPath}`);

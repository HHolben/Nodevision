const fs = require('fs');
const path = require('path');

const notebookDir = path.join(__dirname, 'Notebook');
const generatedNodesPath = path.join(__dirname, 'public', 'GeneratedNodes.js');
const allowedExtensions = ['.html', '.php', '.js', '.py'];

function generateNodes(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const nodes = [];

  entries.forEach(entry => {
    if (entry.isFile() && allowedExtensions.includes(path.extname(entry.name))) {
      const node = {
        data: {
          id: entry.name,
          label: entry.name,
          link: path.join('Notebook', entry.name),
          imageUrl: 'http://localhost:3000/DefaultNodeImage.png',
          IndexNumber: 1
        }
      };
      nodes.push(node);
    }
  });

  return nodes;
}

const nodes = generateNodes(notebookDir);

// Add module.exports so that GeneratedNodes.js can be imported
const nodesOutput = `// GeneratedNodes.js\nconst nodes = [\n${nodes.map(node => JSON.stringify(node)).join(',\n')}\n];\n\nmodule.exports = nodes;`;

fs.writeFileSync(generatedNodesPath, nodesOutput, 'utf8');
console.log(`Generated nodes have been written to ${generatedNodesPath}`);

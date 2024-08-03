const fs = require('fs');
const path = require('path');

const notebookDir = path.join(__dirname, 'Notebook');
const generatedAllNodesPath = path.join(__dirname, 'public', 'AllNodes.js');
const allowedExtensions = ['.html', '.php', '.js', '.py'];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  entries.forEach(entry => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (allowedExtensions.includes(path.extname(entry.name))) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function generateAllNodes(dir) {
  const files = getAllFiles(dir);
  const nodes = files.map(file => {
    return {
      data: {
        id: path.relative(notebookDir, file),
        label: path.basename(file),
        link: path.relative(__dirname, file),
        imageUrl: 'http://localhost:3000/DefaultNodeImage.png',
        IndexNumber: 1
      }
    };
  });

  return nodes;
}

const allNodes = generateAllNodes(notebookDir);
const allNodesOutput = `// AllNodes.js\nconst allNodes = [\n${allNodes.map(node => JSON.stringify(node)).join(',\n')}\n];\n`;

fs.writeFileSync(generatedAllNodesPath, allNodesOutput, 'utf8');
console.log(`Generated all nodes have been written to ${generatedAllNodesPath}`);

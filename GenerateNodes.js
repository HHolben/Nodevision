const fs = require('fs');
const path = require('path');

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

// Function to generate nodes from files
function generateNodesFromFiles(dirPath) {
  const allFiles = getAllFiles(dirPath);
  const nodes = allFiles
    .filter(file => ['.html', '.php', '.js', '.py'].includes(path.extname(file)))
    .map(file => {
      const relativePath = path.relative(dirPath, file);
      const label = path.basename(file);
      const region = path.dirname(relativePath).split(path.sep).join(' > ');

      return {
        data: {
          id: label,
          label: label,
          region: region,
          link: relativePath,
          soundLocation: '/path/to/sound_location.mp3',
          imageUrl: '/path/to/image/index.png'
        }
      };
    });

  return nodes;
}

// Main function to write nodes to file
function writeNodesToFile(dirPath, outputFilePath) {
  const nodes = generateNodesFromFiles(dirPath);
  const nodesFileContent = `var nodes = ${JSON.stringify(nodes, null, 2)};`;

  fs.writeFileSync(outputFilePath, nodesFileContent, 'utf8');
  console.log(`Generated nodes have been written to ${outputFilePath}`);
}

// Paths
const notebookDir = path.join(__dirname, 'Notebook');
const outputFilePath = path.join(__dirname, 'public', 'GeneratedNodes.js');

// Generate and write nodes to file
writeNodesToFile(notebookDir, outputFilePath);

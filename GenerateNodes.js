const fs = require('fs');
const path = require('path');

// Constants
const NODE_EXTENSIONS = ['.html', '.php', '.js', '.py'];
const DEFAULT_IMAGE_URL = 'http://localhost:3000/DefaultNodeImage.png';

// Maximum nodes to display
let MaximumNodesDisplayed = 100; // Default value, can be adjusted via index.html

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
  let index = 0; // Initialize index counter

  const nodes = allFiles
    .filter(file => NODE_EXTENSIONS.includes(path.extname(file)))
    .slice(0, MaximumNodesDisplayed) // Limit the number of nodes
    .map(file => {
      const relativePath = path.relative(dirPath, file);
      const label = path.basename(file);
      const region = path.dirname(relativePath).split(path.sep).join(' > ');

      // Set the image URL to the default image URL
      const imageUrl = DEFAULT_IMAGE_URL;

      const node = {
        data: {
          id: relativePath,
          label: label,
          link: relativePath,
          imageUrl: imageUrl, // Set the image URL
          IndexNumber: index // Assign the index number
        }
      };

      index++; // Increment index for the next node
      return node;
    });

  return nodes;
}

// Paths
const notebookDir = path.join(__dirname, 'Notebook');
const outputFilePath = path.join(__dirname, 'public', 'GeneratedNodes.js');

// Generate and write nodes to file
const nodes = generateNodesFromFiles(notebookDir);
const nodesFileContent = `var nodes = [\n${nodes.map(node => JSON.stringify(node)).join(',\n')}\n];\n`;

fs.writeFileSync(outputFilePath, nodesFileContent, 'utf8');
console.log(`Generated nodes have been written to ${outputFilePath}`);
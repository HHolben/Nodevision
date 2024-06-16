const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio'); // Assuming you'll use Cheerio to parse HTML files

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

// Function to extract image URL from HTML file using Cheerio
function extractImageUrlFromHtml(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(fileContent);
  const imgElement = $('img').first(); // Select the first <img> element
  const imageUrl = imgElement.attr('src'); // Get the src attribute of the image

  return imageUrl;
}

// Function to generate nodes from files
function generateNodesFromFiles(dirPath) {
  const allFiles = getAllFiles(dirPath);
  const nodes = allFiles
    .filter(file => ['.html', '.php', '.js', '.py'].includes(path.extname(file)))
    .slice(0, MaximumNodesDisplayed) // Limit the number of nodes
    .map(file => {
      const relativePath = path.relative(dirPath, file);
      const label = path.basename(file);
      const region = path.dirname(relativePath).split(path.sep).join(' > ');

      const imageUrl = extractImageUrlFromHtml(file);
      const fullImageUrl = imageUrl ? `http://localhost:8000/${path.join(path.dirname(relativePath), imageUrl)}` : 'http://localhost:3000/DefaultNodeImage.png'; // Get the full image URL

      return {
        data: {
          id: relativePath,
          label: label,
          link: relativePath,
          //soundLocation: '/path/to/sound_location.mp3',
          imageUrl: fullImageUrl // Set the image URL
        }
      };
    });

  return nodes;
}

// Main function to write nodes to file
function writeNodesToFile(dirPath, outputFilePath) {
  const nodes = generateNodesFromFiles(dirPath);
  const nodesFileContent = 'var nodes = [\n' + nodes.map(node => JSON.stringify(node)).join(',\n') + '\n];';

  fs.writeFileSync(outputFilePath, nodesFileContent, 'utf8');
  console.log(`Generated nodes have been written to ${outputFilePath}`);
}

// Paths
const notebookDir = path.join(__dirname, 'Notebook');
const outputFilePath = path.join(__dirname, 'public', 'GeneratedNodes.js');

// Generate and write nodes to file
writeNodesToFile(notebookDir, outputFilePath);

// Function to set the maximum nodes displayed value from an external source
function setMaximumNodesDisplayed(value) {
  MaximumNodesDisplayed = value;
  console.log(`MaximumNodesDisplayed set to ${MaximumNodesDisplayed}`);
}

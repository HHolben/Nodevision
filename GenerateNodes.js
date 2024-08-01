const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Constants
const DEFAULT_IMAGE_URL = 'http://localhost:3000/DefaultNodeImage.png';
const NODE_EXTENSIONS = ['.html', '.php', '.js', '.py'];

// Maximum nodes to display
let MaximumNodesDisplayed = 100; // Default value, can be adjusted via index.html

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

// Function to extract image URL from HTML file using Cheerio
function extractImageUrlFromHtml(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(fileContent);
    const imgElement = $('img').first();
    const imageUrl = imgElement.attr('src');
    return imageUrl;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Function to generate nodes from top-level files
function generateNodesFromTopLevelFiles(dirPath) {
  const topLevelFiles = getTopLevelFiles(dirPath);
  let index = 0;

  const nodes = topLevelFiles
    .filter(file => NODE_EXTENSIONS.includes(path.extname(file)))
    .slice(0, MaximumNodesDisplayed)
    .map(file => {
      const relativePath = path.relative(dirPath, file);
      const label = path.basename(file);
      const imageUrl = extractImageUrlFromHtml(file);
      const fullImageUrl = imageUrl ? `http://localhost:8000/${path.join(path.dirname(relativePath), imageUrl)}` : DEFAULT_IMAGE_URL;

      return {
        data: {
          id: relativePath,
          label: label,
          link: relativePath,
          imageUrl: fullImageUrl,
          IndexNumber: index++
        }
      };
    });

  return nodes;
}

// Main function to write nodes to file
function writeNodesToFile(dirPath, outputFilePath) {
  try {
    const nodes = generateNodesFromTopLevelFiles(dirPath);
    const nodesFileContent = 'var nodes;\n\nfunction ReadNodes() {\n  nodes = [\n' + nodes.map(node => '    ' + JSON.stringify(node)).join(',\n') + '\n  ];\n}\n\nReadNodes();';

    fs.writeFileSync(outputFilePath, nodesFileContent, 'utf8');
    console.log(`Generated nodes have been written to ${outputFilePath}`);
  } catch (error) {
    console.error(`Error writing to file ${outputFilePath}:`, error);
  }
}

// Paths
const notebookDir = path.join(__dirname, 'Notebook');
const outputFilePath = path.join(__dirname, 'public', 'GeneratedNodes.js');

// Generate and write nodes to file
writeNodesToFile(notebookDir, outputFilePath);

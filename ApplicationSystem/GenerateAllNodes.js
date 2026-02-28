//Nodevision/ApplicationSystem/GenerateAllNodes.js
// Purpose: Generate comprehensive node data for graph visualization from file system
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio'); // Assuming you'll use Cheerio to parse HTML files

// Constants
const DEFAULT_IMAGE_URL = 'http://localhost:3000/DefaultNodeImage.png';


// Function to recursively get all files in a directory
function getAllFiles(dirPath, arrayOfFiles = []) {
  try {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
      } else {
        arrayOfFiles.push(filePath);
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }

  return arrayOfFiles;
}

// Function to extract image URL from HTML file using Cheerio
function extractImageUrlFromHtml(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(fileContent);
    const imgElement = $('img').first(); // Select the first <img> element
    const imageUrl = imgElement.attr('src'); // Get the src attribute of the image

    return imageUrl;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Function to generate nodes from files
function generateNodesFromFiles(dirPath) {
  const allFiles = getAllFiles(dirPath);
  let index = 0; // Initialize index counter

  const AllNodes = allFiles
    .map(file => {
      const relativePath = path.relative(dirPath, file);
      const label = path.basename(file);
      const region = path.dirname(relativePath).split(path.sep).join(' > ');

      const imageUrl = extractImageUrlFromHtml(file);
      const fullImageUrl = imageUrl ? `http://localhost:8000/${path.join(path.dirname(relativePath), imageUrl)}` : DEFAULT_IMAGE_URL; // Get the full image URL

      const node = {
        data: {
          id: relativePath,
          label: label,
          link: relativePath,
          // soundLocation: '/path/to/sound_location.mp3',
          imageUrl: fullImageUrl, // Set the image URL
          IndexNumber: index // Assign the index number
        }
      };

      index++; // Increment index for the next node
      return node;
    });

  return AllNodes;
}

// Main function to write nodes to file
function writeNodesToFile(dirPath, outputFilePath) {
  try {
    const AllNodes = generateNodesFromFiles(dirPath);
    const nodesFileContent = 'var AllNodes;\n\nfunction ReadNodes() {\n  AllNodes = [\n' + AllNodes.map(node => '    ' + JSON.stringify(node)).join(',\n') + '\n  ];\n}\n\nReadNodes();';

    fs.writeFileSync(outputFilePath, nodesFileContent, 'utf8');
    console.log(`Generated nodes have been written to ${outputFilePath}`);
  } catch (error) {
    console.error(`Error writing to file ${outputFilePath}:`, error);
  }
}

// Paths
const ROOT_DIR = path.resolve(__dirname, '..');
const notebookDir = path.join(ROOT_DIR, 'Notebook');
const outputFilePath = path.join(__dirname, 'public', 'AllNodes.js');

// Generate and write nodes to file
writeNodesToFile(notebookDir, outputFilePath);

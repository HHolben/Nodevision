// GenerateRegions.js
// Purpose: Create hierarchical regions for organizing graph nodes by directory

const fs = require('fs');
const path = require('path');

// Maximum regions to display
let MaximumRegionsDisplayed = 100; // Default value, can be adjusted via index.html

const notebookDir = path.join(__dirname, 'Notebook');
const generatedRegionsPath = path.join(__dirname, 'public', 'GeneratedRegions.js');

function generateRegions(dir, parent = null, relativeDir = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const regions = [];

    entries.forEach(entry => {
        const currentPath = path.join(relativeDir, entry.name);
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            // Check if directory.png exists in this directory
            let imageUrl = 'http://localhost:3000/DefaultRegionImage.png';
            const customImagePath = path.join(fullPath, 'directory.png');

            if (fs.existsSync(customImagePath)) {
                imageUrl = `http://localhost:3000/Notebook/${currentPath}/directory.png`;
            }

            // Create a region node with the expanded flag set to false by default
            const region = {
                data: {
                    id: currentPath,
                    label: entry.name,
                    type: 'region',
                    imageUrl: imageUrl, // Use the found image URL or default
                    expanded: false    // Mark region as collapsed by default
                }
            };

            if (parent) {
                region.data.parent = parent;
            }

            regions.push(region);
        } else if (entry.isFile() && ['.html', '.php', '.js', '.py'].includes(path.extname(entry.name))) {
            const fileNode = {
                data: {
                    id: currentPath,
                    label: entry.name,
                    parent: parent,
                    type: 'node' // Explicitly marking as node
                }
            };

            regions.push(fileNode);
        }
    });

    return regions;
}

// Generate only the regions and nodes directly under the Notebook directory
const regions = generateRegions(notebookDir)
  .filter(region => region.data.type === 'region')
  .slice(0, MaximumRegionsDisplayed);

const regionsOutput = `// GeneratedRegions.js\nconst regions = [\n${regions.map(region => JSON.stringify(region)).join(',\n')}\n];\n`;

fs.writeFileSync(generatedRegionsPath, regionsOutput, 'utf8');
console.log(`Generated regions have been written to ${generatedRegionsPath}`);

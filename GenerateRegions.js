const fs = require('fs');
const path = require('path');

// Maximum regions to display
let MaximumRegionsDisplayed = 100; // Default value, can be adjusted via index.html

const notebookDir = path.join(__dirname, 'Notebook');
const generatedRegionsPath = path.join(__dirname, 'public', 'GeneratedRegions.js');

// Path to the default region image
const defaultRegionImage = 'http://localhost:3000/DefaultRegionImage.png';

function generateRegions(dir, parent = null, relativeDir = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const regions = [];

  entries.forEach(entry => {
    const currentPath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      const region = {
        data: {
          id: currentPath,
          label: entry.name,
          imageUrl: defaultRegionImage // Add the default region image
        }
      };

      if (parent) {
        region.data.parent = parent;
      }

      regions.push(region);
    }
  });

  return regions;
}

const regions = generateRegions(notebookDir).slice(0, MaximumRegionsDisplayed); // Limit the number of regions

const regionsOutput = `// GeneratedRegions.js\nconst regions = [\n${regions.map(region => JSON.stringify(region)).join(',\n')}\n];\n`;

fs.writeFileSync(generatedRegionsPath, regionsOutput, 'utf8');
console.log(`Generated regions have been written to ${generatedRegionsPath}`);

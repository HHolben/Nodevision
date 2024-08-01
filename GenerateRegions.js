const fs = require('fs');
const path = require('path');

// Maximum regions to display
let MaximumRegionsDisplayed = 100; // Default value, can be adjusted via index.html

const notebookDir = path.join(__dirname, 'Notebook');
const generatedRegionsPath = path.join(__dirname, 'public', 'GeneratedRegions.js');

// Function to generate regions (directories) only
function generateRegions(dir, parent = null) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const regions = [];

  entries.forEach(entry => {
    if (entry.isDirectory()) {
      const currentPath = path.join(path.relative(notebookDir, dir), entry.name); // Relative path from the Notebook directory
      const region = {
        data: {
          id: currentPath,
          label: entry.name,
        }
      };

      if (parent) {
        region.data.parent = parent;
      }

      regions.push(region);
      const subDir = path.join(dir, entry.name);
      // Recursively add subdirectories
      regions.push(...generateRegions(subDir, currentPath));
    }
  });

  return regions;
}

// Generate regions and limit the number of regions
const regions = generateRegions(notebookDir).slice(0, MaximumRegionsDisplayed);

const regionsOutput = `// GeneratedRegions.js\nconst regions = [\n${regions.map(region => JSON.stringify(region)).join(',\n')}\n];\n`;

fs.writeFileSync(generatedRegionsPath, regionsOutput, 'utf8');
console.log(`Generated regions have been written to ${generatedRegionsPath}`);

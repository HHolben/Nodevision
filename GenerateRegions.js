const fs = require('fs');
const path = require('path');

const notebookDir = path.join(__dirname, 'Notebook');
const generatedRegionsPath = path.join(__dirname, 'public', 'GeneratedRegions.js');

function generateRegions(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const regions = [];

  entries.forEach(entry => {
    if (entry.isDirectory()) {
      const region = {
        name: entry.name,
        nodes: [],
        regions: []
      };

      const subDir = path.join(dir, entry.name);
      const subEntries = fs.readdirSync(subDir, { withFileTypes: true });

      subEntries.forEach(subEntry => {
        if (subEntry.isFile() && ['.html', '.php', '.js', '.py'].includes(path.extname(subEntry.name))) {
          region.nodes.push(subEntry.name);
        } else if (subEntry.isDirectory()) {
          region.regions.push(subEntry.name);
        }
      });

      region.subRegions = generateRegions(subDir);
      regions.push(region);
    }
  });

  return regions;
}

const regions = generateRegions(notebookDir);

const regionsOutput = `// GeneratedRegions.js\nconst regions = ${JSON.stringify(regions, null, 2)};\n`;

fs.writeFileSync(generatedRegionsPath, regionsOutput, 'utf8');
console.log(`Generated regions have been written to ${generatedRegionsPath}`);

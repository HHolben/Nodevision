const fs = require('fs');
const path = require('path');

const notebookDir = path.join(__dirname, 'Notebook');
const generatedRegionsPath = path.join(__dirname, 'public', 'GeneratedRegions.js');

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
        }
      };

      if (parent) {
        region.data.parent = parent;
      }

      regions.push(region);
      const subDir = path.join(dir, entry.name);
      regions.push(...generateRegions(subDir, currentPath, currentPath));

    } else if (entry.isFile() && ['.html', '.php', '.js', '.py'].includes(path.extname(entry.name))) {
      const fileNode = {
        data: {
          id: currentPath,
          label: entry.name,
          parent: parent
        }
      };

      regions.push(fileNode);
    }
  });

  return regions;
}

const regions = generateRegions(notebookDir);

const regionsOutput = `// GeneratedRegions.js\nconst regions = [\n${regions.map(region => JSON.stringify(region)).join(',\n')}\n];\n`;

fs.writeFileSync(generatedRegionsPath, regionsOutput, 'utf8');
console.log(`Generated regions have been written to ${generatedRegionsPath}`);

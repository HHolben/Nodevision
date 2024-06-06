const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const notebookDir = path.join(__dirname, 'Notebook');
const generatedEdgesPath = path.join(__dirname, 'public', 'GeneratedEdges.js');

const nodes = require('./public/GeneratedNodes');

function extractEdgesFromHTML(filePath) {
  const htmlContent = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(htmlContent);
  const edges = [];

  $('a').each((index, element) => {
    const href = $(element).attr('href');
    if (href) {
      edges.push({
        source: path.basename(filePath),
        target: href,
        type: 'link' // or derive the type if needed
      });
    }
  });

  return edges;
}

function generateEdgesFromFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let edges = [];

  files.forEach(file => {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      edges = edges.concat(generateEdgesFromFiles(fullPath));
    } else if (file.isFile() && ['.html', '.php', '.js', '.py'].includes(path.extname(file.name))) {
      edges = edges.concat(extractEdgesFromHTML(fullPath));
    }
  });

  return edges;
}

const edges = generateEdgesFromFiles(notebookDir);

const edgesOutput = `// GeneratedEdges.js\nconst edges = ${JSON.stringify(edges, null, 2)};\n`;

fs.writeFileSync(generatedEdgesPath, edgesOutput, 'utf8');
console.log(`Generated edges have been written to ${generatedEdgesPath}`);

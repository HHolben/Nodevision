const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

const notebookDir = path.join(__dirname, 'Notebook');
const generatedEdgesPath = path.join(__dirname, 'public', 'AllEdges.js');

// Function to get all files with allowed extensions
async function getAllFiles(dirPath, allowedExtensions, arrayOfFiles = []) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                arrayOfFiles = await getAllFiles(fullPath, allowedExtensions, arrayOfFiles);
            } else if (allowedExtensions.includes(path.extname(entry.name))) {
                arrayOfFiles.push(fullPath);
            }
        }
    } catch (err) {
        console.error(`Error reading directory ${dirPath}:`, err);
    }
    return arrayOfFiles;
}

// Function to parse a file and extract links
async function extractLinksFromFile(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const $ = cheerio.load(fileContent);

        const links = [];
        $('a[href], script[src], link[href]').each((_, element) => {
            const srcOrHref = $(element).attr('href') || $(element).attr('src');
            if (srcOrHref) {
                links.push(srcOrHref);
            }
        });

        return links;
    } catch (err) {
        console.error(`Error reading or parsing file ${filePath}:`, err);
        return [];
    }
}

// Function to generate edges
async function generateEdges() {
    try {
        const allowedExtensions = ['.html', '.php', '.js', '.py'];
        const files = await getAllFiles(notebookDir, allowedExtensions);
        const edges = [];

        for (const file of files) {
            const fileLinks = await extractLinksFromFile(file);
            for (const link of fileLinks) {
                // Resolve the link relative to the current file's directory
                const targetFile = path.resolve(path.dirname(file), link);

                // Log for debugging
                console.log(`Checking link: ${link}`);
                console.log(`Resolved to: ${targetFile}`);

                // Check if the resolved target exists and is within the allowed files
                if (files.includes(targetFile)) {
                    const relativeSource = path.relative(notebookDir, file);
                    const relativeTarget = path.relative(notebookDir, targetFile);
                    edges.push({
                        data: {
                            source: relativeSource,
                            target: relativeTarget
                        }
                    });
                } else {
                    console.log(`Target file does not exist or is not allowed: ${targetFile}`);
                }
            }
        }

        const edgesOutput = `// AllEdges.js\nconst allEdges = [\n${edges.map(edge => JSON.stringify(edge)).join(',\n')}\n];\n`;

        await fs.writeFile(generatedEdgesPath, edgesOutput, 'utf8');
        console.log(`Generated edges have been written to ${generatedEdgesPath}`);
    } catch (err) {
        console.error('Error generating edges:', err);
    }
}

// Export the function for external use
module.exports = { generateEdges };

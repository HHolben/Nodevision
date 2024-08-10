const fs = require('fs');
const path = require('path');

const notebookDir = path.join(__dirname, 'Notebook');
const allowedExtensions = ['.html', '.php', '.js', '.py']; // Allowed file extensions

function getAllFiles(dirPath, arrayOfFiles = []) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    entries.forEach(entry => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else if (allowedExtensions.includes(path.extname(entry.name).toLowerCase())) {
            // Only add files with allowed extensions
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

function generateAllNodes(dir) {
    const files = getAllFiles(dir);
    const nodes = files.map(file => {
        return {
            data: {
                id: path.relative(notebookDir, file),
                label: path.basename(file),
                link: path.relative(__dirname, file),
                imageUrl: 'http://localhost:3000/DefaultNodeImage.png',
                IndexNumber: 1
            }
        };
    });

    return nodes;
}

module.exports = {
    generateAllNodes,
};

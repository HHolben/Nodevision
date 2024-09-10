module.exports = (app, path, fs) => {
// Single instance of getSubNodes API
app.get('/api/getSubNodes', async (req, res) => {
    const regionPath = req.query.path;
    if (!regionPath) {
        return res.status(400).send('Region path is required');
    }

    const dirPath = path.join(__dirname, 'Notebook', regionPath);

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const subNodes = await Promise.all(entries.map(async entry => {
            let imageUrl = 'DefaultNodeImage.png'; // Default image for nodes
            const fileExtension = path.extname(entry.name).toLowerCase();

            if (entry.isDirectory()) {
                const directoryImage = path.join(dirPath, entry.name, 'directory.png');
                try {
                    await fs.access(directoryImage);
                    imageUrl = `Notebook/${regionPath}/${entry.name}/directory.png`;
                } catch {
                    imageUrl = 'DefaultRegionImage.png';
                }
                return {
                    id: path.join(regionPath, entry.name),
                    label: entry.name,
                    isDirectory: true,
                    imageUrl: imageUrl
                };
            } else if (allowedExtensions.includes(fileExtension)) {
                const filePath = path.join(dirPath, entry.name);
                const firstImage = await getFirstImageUrl(filePath);
                imageUrl = firstImage ? firstImage : 'DefaultNodeImage.png';
                return {
                    id: path.join(regionPath, entry.name),
                    label: entry.name,
                    isDirectory: false,
                    imageUrl: imageUrl
                };
            } else {
                return null; // Skip non-allowed file types
            }
        }));

        // Filter out null values (non-allowed file types)
        const filteredSubNodes = subNodes.filter(node => node !== null);

        res.json(filteredSubNodes);
    } catch (error) {
        console.error('Error reading directory:', error);
        res.status(500).send('Error reading directory');
    }
});
};
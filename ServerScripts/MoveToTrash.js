module.exports = (app, path, fs) => {
    // Route to move node or directory to the Trash
app.post('/moveToTrash', async (req, res) => {
    const { itemName } = req.body;
    
    if (!itemName) {
        return res.status(400).json({ message: 'Item name is required.' });
    }

    const itemPath = path.join(__dirname, 'Nodevision', itemName);
    
    try {
        // Check if the node or directory exists
        const itemStats = await fs.stat(itemPath);
        
        // Construct the destination path inside the Trash directory
        const trashPath = path.join(trashDirectory, itemName);
        
        // Move the directory or file to the Trash folder
        await fs.rename(itemPath, trashPath);

        res.json({ message: `Successfully moved '${itemName}' to the Trash.` });
    } catch (err) {
        console.error('Error moving to Trash:', err);

        if (err.code === 'ENOENT') {
            return res.status(404).json({ message: `Node or directory '${itemName}' not found.` });
        }

        return res.status(500).json({ message: 'Error moving the item to Trash.' });
    }
});
};
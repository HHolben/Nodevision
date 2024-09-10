module.exports = (app, path, fs, upload) => {
    app.post('/upload-image', upload.single('image'), (req, res) => {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const filePath = `/Notebook/${req.file.filename}`;  // Return path for serving
        res.json({ success: true, message: 'Image uploaded successfully', filePath });
    });
};

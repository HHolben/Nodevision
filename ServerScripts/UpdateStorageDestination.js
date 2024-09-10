const multer = require('multer');
const path = require('path');

// Define storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../Notebook');  // Ensure this path exists
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);  // Save file with its original name
    }
});

// Initialize multer with the defined storage
const upload = multer({ storage });

module.exports = upload;

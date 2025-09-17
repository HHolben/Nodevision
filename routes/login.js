// routes/login.js
// Purpose: TODO: Add description of module purpose

const express = require('express');
const path = require('path');
const router = express.Router();

// Define the route for the login page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html')); // Adjust the path as needed
});

module.exports = router;

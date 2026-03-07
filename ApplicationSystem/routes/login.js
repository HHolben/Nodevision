// routes/login.js
// Purpose: TODO: Add description of module purpose

const express = require('express');
const path = require('path');
const router = express.Router();

// Redirect legacy login entry points to the SPA root.
router.get('/', (req, res) => {
    res.redirect('/');
});

module.exports = router;

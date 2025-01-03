const express = require('express');
const router = express.Router();

// Login route
router.post('/login', (req, res) => {
    // Route for login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});
});

// Logout route
router.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

module.exports = router;



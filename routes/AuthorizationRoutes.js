// routes/AuthorizationRoutes.js
// Purpose: TODO: Add description of module purpose

const express = require('express');
const passport = require('passport');
const path = require('path'); // Import path module
const router = express.Router();

// Login route
router.post('/login', passport.authenticate('local', {
    successRedirect: '/public/index.html', // Redirect to the index page upon success
    failureRedirect: '/login',     // Redirect back to the login page upon failure
    failureFlash: true             // Enable flash messages for errors (requires flash middleware)
}));

// Serve the login page
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Logout route
router.get('/logout', (req, res) => {
    if (req.logout) {
        req.logout(() => res.redirect('/login'));
    } else {
        // Fallback if `req.logout` isn't defined
        req.session.destroy(err => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).send('Error logging out.');
            }
            res.redirect('/login');
        });
    }
});

module.exports = router;

// Nodevision/ApplicationSystem/routes/auth.js
// This file defines auth routes for the Nodevision server. It registers endpoints and coordinates request handling.
// routes/auth.js
// Purpose: TODO: Add description of module purpose

// Legacy route now simply returns to the SPA root.
app.get('/', (req, res) => {
    res.redirect('/');
});

// Middleware for parsing form data
app.use(express.urlencoded({ extended: true }));

// Route to handle login POST request
app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.redirect('/login?error=true');

        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.redirect('/index');
        });
    })(req, res, next);
});

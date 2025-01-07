const express = require('express');//simplifies back-end development: https://www.geeksforgeeks.org/getting-started-with-express-js/
const path = require('path');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const fs = require('fs').promises; // For async operations
const multer = require('multer');
const cheerio = require('cheerio');
const app = express();
const port = 3000;

//set up a database
const PouchDB = require('pouchdb');
const db = new PouchDB('users'); // Creates a local database named 'users' 

// These libraries are for setting up passport.js. This is for user authentication: https://www.keycloak.org/securing-apps/nodejs-adapter
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const MemoryStore = require('memorystore')(session);

// Import routes
const initializeRoute = require('./routes/api/initialize');//used for creating new files
const initializeRoutes = require('./routes/api/initializeRoutes'); // Import initialize route
const fileRoutes = require('./routes/api/files');
const folderRoutes = require('./routes/api/folderRoutes');
const arduinoRoutes = require('./routes/api/arduinoRoutes');
const fileSaveRoutes = require('./routes/api/fileSaveRoutes');
const regenerateNodesRoutes = require('./routes/api/regenerateNodesRoutes'); // Import new route
const generateEdgesRoutes = require('./routes/api/generateEdgesRoutes'); // Import new route
const getSubNodesRoutes = require('./routes/api/getSubNodesRoutes'); // Import new route
const fileCodeContentRoutes = require('./routes/api/fileCodeContentRoutes'); // Import new route
const fileSearchRoutes = require('./routes/api/search'); // Import search route
const graphStylesRoutes = require('./routes/api/graphStyles'); // Import search route
const uploadImageRoutes = require('./routes/api/uploadImage'); // Import search route


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));

// Routes
app.use('/api', initializeRoute);//use for creating new files
app.use('/api', initializeRoutes); // Add initialize route
app.use('/api/files', fileRoutes);       // File routes (e.g. /api/files)
app.use('/api/folderRoutes', folderRoutes);       // Folder routes (e.g. /api/folderRoutes)
app.use('/api/arduino', arduinoRoutes);  // Arduino routes (e.g. /api/arduino/ports, /api/arduino/upload)
app.use('/api', fileSaveRoutes); // Use the file save routes under '/api'
app.use('/api', regenerateNodesRoutes);  // Add this route for regenerating nodes
app.use('/api', generateEdgesRoutes);  // Add this route for generating edges
app.use('/api', getSubNodesRoutes);  // Add this route for getting sub-nodes
app.use('/api', fileCodeContentRoutes); // Add route for file code content
app.use('/api', fileSearchRoutes); // Add route for file code content
app.use('/api', graphStylesRoutes); // Add route for file code content
app.use('/api', uploadImageRoutes); // Add route for file code content

//We need to use the endpoints stored in the routes folder

// Dummy user store for demonstration (replace with a database in production)
const users = [
    { id: 1, username: 'admin', password: 'password' } // Example user
];

// Configure Passport.js
passport.use(
    new LocalStrategy((username, password, done) => {
        const user = users.find(
            (u) => u.username === username && u.password === password
        );
        if (!user) return done(null, false, { message: 'Incorrect credentials.' });
        return done(null, user);
    })
);

const bcrypt = require('bcrypt');
const saltRounds = 10;

// Hash the password
const hashPassword = async (password) => {
    return await bcrypt.hash(password, saltRounds);
};

// Verify the password
const verifyPassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

const registerUser = async (username, password) => {
    try {
        // Check if the user already exists
        const existingUser = await db.get(username).catch(() => null);
        if (existingUser) {
            console.log('User already exists!');
            return;
        }

        // Hash the password
        const hashedPassword = await hashPassword(password);

        // Store user in the database
        const newUser = {
            _id: username, // Use the username as the document ID
            password: hashedPassword, // Store the hashed password
        };

        await db.put(newUser);
        console.log('User registered successfully!');
    } catch (error) {
        console.error('Error registering user:', error);
    }
};

const authenticateUser = async (username, password) => {
    try {
        // Retrieve the user document
        const user = await db.get(username);

        // Verify the password
        const isMatch = await verifyPassword(password, user.password);
        if (isMatch) {
            console.log('Authentication successful!');
        } else {
            console.log('Invalid password!');
        }
    } catch (error) {
        if (error.status === 404) {
            console.log('User not found!');
        } else {
            console.error('Error authenticating user:', error);
        }
    }
};

(async () => {
    await registerUser('john_doe', 'my_secure_password');
    await authenticateUser('john_doe', 'my_secure_password'); // Authentication successful!
    await authenticateUser('john_doe', 'wrong_password');     // Invalid password!
})();

const remoteDb = new PouchDB('http://username:password@remote-host.com/users');
db.sync(remoteDb).on('complete', () => {
    console.log('Sync completed!');
}).on('error', (err) => {
    console.error('Sync error:', err);
});

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
    const user = users.find((u) => u.id === id);
    done(null, user || false);
});

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
    })
}));

app.use(passport.initialize());
app.use(passport.session());

// Route for login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
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

// Serve index.html for authenticated users
app.get('/index', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware to check authentication
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

app.get('/profile', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

// Increase the request body limit for JSON and urlencoded data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


const allowedExtensions = ['.html', '.php', '.js', '.py'];
const notebookDir = path.join(__dirname, 'Notebook'); // Define notebookDir

// Serve favicon
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));
app.use('/Notebook', express.static(path.join(__dirname, 'Notebook')));

// Update storage destination to save in 'Notebook' directory
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'Notebook'));  // Save to Notebook directory
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));  // Use unique filename
    }
});

const upload = multer({ storage: storage });

// Function to extract the first image URL from the file content
async function getFirstImageUrl(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const $ = cheerio.load(fileContent);
        const firstImageSrc = $('img').first().attr('src');

        if (firstImageSrc) {
            if (firstImageSrc.startsWith('http') || firstImageSrc.startsWith('//')) {
                return firstImageSrc;
            } else {
                const imagePath = path.join(path.dirname(filePath), firstImageSrc);
                const resolvedImagePath = path.relative(path.join(__dirname, 'public'), imagePath);
                return resolvedImagePath.split(path.sep).join('/');
            }
        }
 else {
            return null;
        }
    } catch (error) {
        console.error(`Error reading file for images: ${error}`);
        return null;
    }
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

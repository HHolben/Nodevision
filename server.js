const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const multer = require('multer');
const cheerio = require('cheerio');
const { exec } = require('child_process'); // Add this line
const app = express();
const port = 3000;

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));

// Serve static files (for your HTML page and assets)
app.use(express.static(path.join(__dirname, 'public')));

// POST route to handle the request submission from the frontend
app.post('/send-request', (req, res) => {
    const { endpoint, command } = req.body;
  
    if (!endpoint || !command) {
      return res.status(400).json({ error: 'Endpoint and command are required' });
    }
  
    // Construct the command to execute the sendRequest.js script
    const commandToRun = `node ${path.join(__dirname, 'sendRequest.js')} ${endpoint} "${command}"`;
  
    // Execute the command using exec
    exec(commandToRun, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: stderr || error.message });
      }
  
      // Send back the response from the executed script
      res.json({ response: stdout });
    });
  });
  



//We need to use the endpoints stored in the routes folder

// Dummy user store for demonstration (replace with a database in production)
//const users = [
    //{ id: 1, username: 'admin', password: 'password' } // Example user
//];

// Configure Passport.js
/*passport.use(
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
*/

// New route for /api/endpoint1
app.post('/api/endpoint1', (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  console.log(`Received command at /api/endpoint1: ${command}`);

  // Check if the command is "ping"
  if (command.toLowerCase() === 'ping') {
    return res.json({ message: 'pong' });
  }

  // If command is something else, return a default message
  res.json({ message: 'Command received on endpoint1', receivedCommand: command });
});

// Import routes
const initializeRoute = require('./routes/api/initialize');
const initializeRoutes = require('./routes/api/initializeRoutes');
const fileRoutes = require('./routes/api/files');
const folderRoutes = require('./routes/api/folderRoutes');
const fileSaveRoutes = require('./routes/api/fileSaveRoutes');
const regenerateNodesRoutes = require('./routes/api/regenerateNodesRoutes');
const generateEdgesRoutes = require('./routes/api/generateEdgesRoutes');
const getSubNodesRoutes = require('./routes/api/getSubNodesRoutes');
const fileCodeContentRoutes = require('./routes/api/fileCodeContentRoutes');
const fileSearchRoutes = require('./routes/api/search');
const graphStylesRoutes = require('./routes/api/graphStyles');
const uploadImageRoutes = require('./routes/api/uploadImage');

// Routes
app.use('/api', initializeRoute);
app.use('/api', initializeRoutes);
app.use('/api', fileRoutes);
app.use('/api/folderRoutes', folderRoutes);
app.use('/api', fileSaveRoutes);
app.use('/api', regenerateNodesRoutes);
app.use('/api', generateEdgesRoutes);
app.use('/api', getSubNodesRoutes);
app.use('/api', fileCodeContentRoutes);
app.use('/api', fileSearchRoutes);
app.use('/api', graphStylesRoutes);
app.use('/api', uploadImageRoutes);

// Serve favicon
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// Serve static files from 'public' and 'Notebook' directories
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));
app.use('/Notebook', express.static(path.join(__dirname, 'Notebook')));

// Update storage destination to save in 'Notebook' directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'Notebook'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
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
    } else {
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

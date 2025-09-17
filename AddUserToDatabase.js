// AddUserToDatabase.js
// Purpose: User account creation and database insertion operations

const bcrypt = require('bcrypt');
const PouchDB = require('pouchdb');
const readline = require('readline');
const db = new PouchDB('users');  // Initialize PouchDB database

const saltRounds = 10;

// Create readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for input and add a user
const promptAndAddUser = async () => {
  rl.question('Enter username: ', async (username) => {
    // Check if the user already exists
    const existingUser = await db.get(username).catch(err => null);
    if (existingUser) {
      console.log(`User with username '${username}' already exists.`);
      rl.close();
      return;
    }

    rl.question('Enter password: ', async (password) => {
      rl.question('Enter permissions (read, write, admin): ', async (permissions) => {
        // Validate permissions
        const validPermissions = ['read', 'write', 'admin'];
        if (!validPermissions.includes(permissions)) {
          console.log('Invalid permissions. Must be one of: read, write, admin.');
          rl.close();
          return;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create the user document
        const userDoc = {
          _id: username,  // Username as document ID
          password: hashedPassword,  // Hashed password
          permissions: permissions  // User permissions
        };

        // Add the user document to the database
        try {
          await db.put(userDoc);
          console.log(`User '${username}' added successfully with ${permissions} permissions.`);
        } catch (error) {
          console.error('Error adding user:', error);
        }

        rl.close();
      });
    });
  });
};

// Start the user input process
promptAndAddUser();

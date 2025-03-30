const PouchDB = require('pouchdb');
const db = new PouchDB('users');  // Initialize PouchDB database

// Function to read all users from the database
const readUsers = async () => {
  try {
    // Get all documents from the database
    const result = await db.allDocs({ include_docs: true });

    if (result.rows.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    // Iterate over each document and display username and permissions
    result.rows.forEach(row => {
      const user = row.doc;
      console.log(`Username: ${user._id}, Password: ${user.password}, Permissions: ${user.permissions}`);
    });
  } catch (error) {
    console.error('Error reading users from database:', error);
  }
};

// Start the reading process
readUsers();

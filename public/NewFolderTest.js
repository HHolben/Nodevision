const axios = require('axios');

// Define the base URL for your Express API
const baseURL = 'http://localhost:3000/api/folderRoutes/create-directory';  // Adjust to your server URL

// Function to create a new folder
async function createFolder(folderName, parentPath = '') {
    try {
        // Sending a POST request to the folder creation route
        const response = await axios.post(baseURL, {
            folderName,
            parentPath
        });

        // Handle the success response
        console.log(`Success: ${response.data.message}`);
    } catch (error) {
        // Handle error if request fails
        if (error.response) {
            // The server responded with a status code outside of 2xx
            console.error(`Error: ${error.response.data.error}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Error: No response received from the server');
        } else {
            // Something went wrong setting up the request
            console.error(`Error: ${error.message}`);
        }
    }
}

// Example usage
const folderName = 'newFolder'; // Replace with the name of the folder you want to create
const parentPath = 'subfolder'; // Optional: specify the parent path if creating inside another folder

createFolder(folderName, parentPath);

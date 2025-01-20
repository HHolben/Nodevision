const axios = require('axios');

// Base URL of your server (adjust if necessary)
const BASE_URL = 'http://localhost:3000/api/files';

async function fetchFileStructure() {
    try {
        // Make a GET request to fetch the directory structure
        const response = await axios.get(BASE_URL);

        // Check if response data exists and is an array
        if (Array.isArray(response.data)) {
            console.log('Files and Directories under /Notebook:');
            response.data.forEach(item => {
                if (item.isDirectory) {
                    console.log(`[DIR]  ${item.path}`);
                } else {
                    console.log(`[FILE] ${item.path}`);
                }
            });
        } else {
            console.error('Unexpected response format:', response.data);
        }
    } catch (error) {
        console.error('Error fetching file structure:', error.message);
    }
}

// Fetch and log the file structure
fetchFileStructure();

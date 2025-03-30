const express = require('express');
const router = express.Router();

// Define the endpoint route for sendRequest
router.post('/', (req, res) => {
    const { endpoint, command } = req.body;

    if (!endpoint || !command) {
        return res.status(400).json({ error: 'Endpoint and command are required' });
    }

    console.log(`Sending request to ${endpoint} with command: ${command}`);
    
    // You can add logic to handle the request, e.g., calling another API or processing data
    res.json({ message: `Request to ${endpoint} with command ${command} was successful.` });
});

module.exports = router;

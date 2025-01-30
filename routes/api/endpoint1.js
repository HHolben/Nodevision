const express = require('express');
const router = express.Router();

// ❌ THIS MIGHT BE WRONG
// router.post('/endpoint1', (req, res) => {

// ✅ CHANGE TO THIS
router.post('/', (req, res) => {  
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  console.log(`Received command at /api/endpoint1: ${command}`);

  if (command.toLowerCase() === 'ping') {
    return res.json({ message: 'pong' });
  }

  res.json({ message: 'Command received on endpoint1', receivedCommand: command });
});

module.exports = router;

// routes/api/health.js
// Purpose: Health check endpoint for server status monitoring

import express from 'express';
const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
});

export default router;

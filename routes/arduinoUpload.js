// routes/arduinoUpload.js
// Purpose: TODO: Add description of module purpose
import express from 'express';
import path from 'node:path';
import { exec } from 'node:child_process';
import fs from 'node:fs';

const router = express.Router();

/**
 * POST /api/upload-arduino
 * Body: { path: string, fqbn: string, port: string }
 */
router.post('/upload-arduino', async (req, res) => {
  try {
    const { path: sketchPath, fqbn, port } = req.body;

    if (!sketchPath || !fqbn || !port) {
      return res.status(400).json({ error: 'Missing required fields: path, fqbn, or port' });
    }

    const absolutePath = path.resolve(sketchPath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(400).json({ error: `Sketch file not found at ${absolutePath}` });
    }

    // Construct the Arduino CLI command
    const cmd = `arduino-cli compile --fqbn ${fqbn} "${absolutePath}" && arduino-cli upload -p ${port} --fqbn ${fqbn} "${absolutePath}"`;

    console.log('Executing Arduino upload command:', cmd);

    exec(cmd, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Arduino upload error:', error);
        return res.status(500).send(`Error:\n${stderr || error.message}`);
      }

      console.log('Arduino upload success:\n', stdout);
      res.send(`Upload successful:\n${stdout}`);
    });

  } catch (err) {
    console.error('Unexpected error in /upload-arduino:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

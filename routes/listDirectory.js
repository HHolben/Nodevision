//routes/listDirectory.js
import { Router } from 'express';
import { readdir, stat } from 'fs/promises';
import path from 'path';

const router = Router();

router.get('/list-directory', async (req, res) => {
  const relPath = req.query.path || '';
const fullPath = path.join(process.cwd(), relPath);


  try {
    const entries = await readdir(fullPath, { withFileTypes: true });
    const result = entries.map((entry) => ({
      name: entry.name,
      fileType: entry.isDirectory() ? 'directory' : 'file'
    }));

    res.json(result);
  } catch (err) {
    console.error('Failed to list directory:', fullPath, err); // <-- add this
    res.status(500).json({ error: 'Failed to list directory', details: err.message });
  }
});


export default router;

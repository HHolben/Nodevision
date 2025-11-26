// routes/api/extractEdges.js
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

const router = express.Router();
const notebookDir = path.join(process.cwd(), 'Notebook');

function resolveHref(fileDir, href) {
  if (href.startsWith('/Notebook/')) {
    href = href.slice('/Notebook/'.length);
  }
  return path.resolve(notebookDir, href);
}

router.get('/extractEdges', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath)
    return res.status(400).json({ error: 'File path required' });

  const fullPath = path.join(notebookDir, filePath);

  try {
    const content = await fs.readFile(fullPath, 'utf8');
    const $ = cheerio.load(content);

    const edges = [];

    const links = $('a').map((i, el) => $(el).attr('href')).get();

    for (let href of links) {
      if (!href) continue;

      // normalize leading slash
      if (href.startsWith('/')) href = href.slice(1);
      if (href.startsWith('Notebook/')) href = href.slice('Notebook/'.length);

      const targetPath = path.resolve(notebookDir, href);

      if (!targetPath.startsWith(notebookDir)) continue;

      try {
        await fs.access(targetPath);
        const relative = path.relative(notebookDir, targetPath)
          .split(path.sep).join('/');

        if (relative !== filePath) edges.push(relative);
      } catch {
        // file does not exist, ignore
      }
    }

    console.log(`📌 [extractEdges] Detected edges for ${filePath}:`, edges);
    res.json({ edges });

  } catch (err) {
    console.error('[extractEdges] ERROR:', err);
    res.status(500).json({ error: 'Failed to extract edges' });
  }
});

export default router;

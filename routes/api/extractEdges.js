// routes/api/extractEdges.js
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

const router = express.Router();
const notebookDir = path.join(process.cwd(), 'Notebook');

function isExternalUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://') || 
         url.startsWith('//') || url.startsWith('mailto:') || 
         url.startsWith('javascript:') || url.startsWith('#') ||
         url.startsWith('data:');
}

function normalizeLink(link) {
  if (!link) return null;
  let normalized = link.trim();
  
  if (isExternalUrl(normalized)) return null;
  
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  if (normalized.startsWith('Notebook/')) normalized = normalized.slice('Notebook/'.length);
  
  const hashIdx = normalized.indexOf('#');
  if (hashIdx > 0) normalized = normalized.slice(0, hashIdx);
  
  const queryIdx = normalized.indexOf('?');
  if (queryIdx > 0) normalized = normalized.slice(0, queryIdx);
  
  return normalized || null;
}

router.get('/extractEdges', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath)
    return res.status(400).json({ error: 'File path required' });

  const fullPath = path.join(notebookDir, filePath);
  const fileDir = path.dirname(fullPath);

  try {
    const content = await fs.readFile(fullPath, 'utf8');
    const $ = cheerio.load(content);

    const edgesSet = new Set();

    const linkAttributes = [
      { selector: 'a', attr: 'href' },
      { selector: 'img', attr: 'src' },
      { selector: 'script', attr: 'src' },
      { selector: 'link', attr: 'href' },
      { selector: 'iframe', attr: 'src' },
      { selector: 'audio', attr: 'src' },
      { selector: 'video', attr: 'src' },
      { selector: 'source', attr: 'src' },
      { selector: 'embed', attr: 'src' },
      { selector: 'object', attr: 'data' },
      { selector: '[data-src]', attr: 'data-src' },
      { selector: '[srcset]', attr: 'srcset' },
      { selector: 'form', attr: 'action' },
    ];

    for (const { selector, attr } of linkAttributes) {
      $(selector).each((i, el) => {
        let value = $(el).attr(attr);
        if (!value) return;

        if (attr === 'srcset') {
          const srcsetParts = value.split(',').map(s => s.trim().split(/\s+/)[0]);
          for (const src of srcsetParts) {
            const normalized = normalizeLink(src);
            if (normalized) edgesSet.add(normalized);
          }
        } else {
          const normalized = normalizeLink(value);
          if (normalized) edgesSet.add(normalized);
        }
      });
    }

    const edges = [];
    for (const link of edgesSet) {
      const targetPath = path.resolve(fileDir, link);
      
      if (!targetPath.startsWith(notebookDir)) continue;
      
      try {
        await fs.access(targetPath);
        const relative = path.relative(notebookDir, targetPath)
          .split(path.sep).join('/');
        
        if (relative !== filePath && !edges.includes(relative)) {
          edges.push(relative);
        }
      } catch {
        const altPath = path.resolve(notebookDir, link);
        if (!altPath.startsWith(notebookDir)) continue;
        
        try {
          await fs.access(altPath);
          const relative = path.relative(notebookDir, altPath)
            .split(path.sep).join('/');
          
          if (relative !== filePath && !edges.includes(relative)) {
            edges.push(relative);
          }
        } catch {
        }
      }
    }

    console.log(`📌 [extractEdges] Detected ${edges.length} edges for ${filePath}:`, edges);
    res.json({ edges });

  } catch (err) {
    console.error('[extractEdges] ERROR:', err);
    res.status(500).json({ error: 'Failed to extract edges' });
  }
});

router.post('/extractEdgesBatch', async (req, res) => {
  const { files } = req.body;
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'files array required' });
  }

  const results = {};
  
  for (const filePath of files) {
    const fullPath = path.join(notebookDir, filePath);
    const fileDir = path.dirname(fullPath);
    
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) continue;
      
      const ext = path.extname(filePath).toLowerCase();
      if (!['.html', '.htm', '.php', '.xhtml'].includes(ext)) continue;
      
      const content = await fs.readFile(fullPath, 'utf8');
      const $ = cheerio.load(content);
      
      const edgesSet = new Set();
      
      const linkAttributes = [
        { selector: 'a', attr: 'href' },
        { selector: 'img', attr: 'src' },
        { selector: 'script', attr: 'src' },
        { selector: 'link', attr: 'href' },
        { selector: 'iframe', attr: 'src' },
        { selector: 'audio', attr: 'src' },
        { selector: 'video', attr: 'src' },
        { selector: 'source', attr: 'src' },
        { selector: 'embed', attr: 'src' },
        { selector: 'object', attr: 'data' },
        { selector: '[data-src]', attr: 'data-src' },
        { selector: '[srcset]', attr: 'srcset' },
        { selector: 'form', attr: 'action' },
      ];

      for (const { selector, attr } of linkAttributes) {
        $(selector).each((i, el) => {
          let value = $(el).attr(attr);
          if (!value) return;

          if (attr === 'srcset') {
            const srcsetParts = value.split(',').map(s => s.trim().split(/\s+/)[0]);
            for (const src of srcsetParts) {
              const normalized = normalizeLink(src);
              if (normalized) edgesSet.add(normalized);
            }
          } else {
            const normalized = normalizeLink(value);
            if (normalized) edgesSet.add(normalized);
          }
        });
      }

      const edges = [];
      for (const link of edgesSet) {
        const targetPath = path.resolve(fileDir, link);
        
        if (targetPath.startsWith(notebookDir)) {
          try {
            await fs.access(targetPath);
            const relative = path.relative(notebookDir, targetPath).split(path.sep).join('/');
            if (relative !== filePath && !edges.includes(relative)) {
              edges.push(relative);
            }
          } catch {}
        }
        
        const altPath = path.resolve(notebookDir, link);
        if (altPath.startsWith(notebookDir) && altPath !== targetPath) {
          try {
            await fs.access(altPath);
            const relative = path.relative(notebookDir, altPath).split(path.sep).join('/');
            if (relative !== filePath && !edges.includes(relative)) {
              edges.push(relative);
            }
          } catch {}
        }
      }

      if (edges.length > 0) {
        results[filePath] = edges;
      }
    } catch (err) {
    }
  }

  console.log(`📌 [extractEdgesBatch] Processed ${files.length} files, found edges in ${Object.keys(results).length}`);
  res.json({ edgeMap: results });
});

export default router;

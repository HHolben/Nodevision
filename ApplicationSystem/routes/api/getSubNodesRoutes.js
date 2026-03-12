// routes/api/getSubNodesRoutes.js
// Retrieve child nodes and related data

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createGetSubNodesRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const notebookDir = ctx.notebookDir;

  async function getFirstImageUrl(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const $ = cheerio.load(fileContent);
      const firstImageSrc = $('img').first().attr('src');

      if (firstImageSrc) {
        if (firstImageSrc.startsWith('http') || firstImageSrc.startsWith('//')) {
          return firstImageSrc;
        }
        const imagePath = path.join(path.dirname(filePath), firstImageSrc);
        const relativePath = path.relative(notebookDir, imagePath).split(path.sep).join('/');
        return relativePath;
      }
      return null;
    } catch (error) {
      console.error(`Error reading file for images: ${error}`);
      return null;
    }
  }

  router.get('/getSubNodes', async (req, res) => {
    const regionPath = req.query.path;
    if (!regionPath) {
      return res.status(400).send('Region path is required');
    }

    const dirPath = path.join(notebookDir, regionPath);

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const subNodes = await Promise.all(entries.map(async entry => {
        let imageUrl = 'DefaultNodeImage.png';
        if (entry.isDirectory()) {
          const directoryImage = path.join(dirPath, entry.name, 'directory.png');
          try {
            await fs.access(directoryImage);
            imageUrl = `Notebook/${regionPath}/${entry.name}/directory.png`;
          } catch {
            imageUrl = 'DefaultRegionImage.png';
          }
          return {
            id: path.join(regionPath, entry.name),
            label: entry.name,
            isDirectory: true,
            imageUrl
          };
        }

        const filePath = path.join(dirPath, entry.name);
        const firstImage = await getFirstImageUrl(filePath);
        imageUrl = firstImage ? firstImage : 'DefaultNodeImage.png';
        return {
          id: path.join(regionPath, entry.name),
          label: entry.name,
          isDirectory: false,
          imageUrl
        };
      }));

      const filteredSubNodes = subNodes.filter(node => node !== null);
      res.json(filteredSubNodes);
    } catch (error) {
      console.error('Error reading directory:', error);
      res.status(500).send('Error reading directory');
    }
  });

  return router;
}

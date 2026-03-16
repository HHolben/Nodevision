// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes.js
// This file defines notebook file save and filesystem manipulation routes so that the Nodevision client can create, update, move, and delete notebook content.

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerContext } from '../../shared/serverContext.mjs';
import { normalizeClientPath, resolveNotebookPath, resolveUserSettingsPath } from "./fileSaveRoutes/paths.js";
import { deleteOrTrashPath } from "./fileSaveRoutes/trash.js";
import { writePayloadToFile } from "./fileSaveRoutes/writePayload.js";

const BASE_CONTEXT = createServerContext();

export default function createFileSaveRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const NOTEBOOK_ROOT = ctx.notebookDir;
  const USER_SETTINGS_ROOT = ctx.userSettingsDir;
  const USER_TRASH_ROOT = path.join(USER_SETTINGS_ROOT, 'Trash');

  router.post('/save', async (req, res) => {
    const {
      path: relativePath,
      content,
      encoding = 'utf8',
      mimeType,
      bom = false
    } = req.body;

    if (!relativePath) {
      return res.status(400).json({ error: "File path is required" });
    }
    if (content === undefined) {
      return res.status(400).json({ error: "File content is required" });
    }

    const filePath = resolveNotebookPath({ notebookRoot: NOTEBOOK_ROOT, relativePath });

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await writePayloadToFile({ filePath, content, encoding, mimeType, bom, logPath: relativePath });

      res.json({ success: true, path: relativePath });
    } catch (err) {
      if (err?.code === "UNSUPPORTED_ENCODING") {
        return res.status(400).json({ error: err.message });
      }
      console.error("Error saving file:", err);
      res.status(500).json({ error: "Error saving file" });
    }
  });

  router.post('/create', async (req, res) => {
    const { path: relativePath } = req.body;
    if (!relativePath) return res.status(400).send('File path is required');

    const filePath = resolveNotebookPath({ notebookRoot: NOTEBOOK_ROOT, relativePath });
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, '', { flag: 'wx' });
      res.json({ success: true, path: relativePath });
    } catch (err) {
      if (err.code === 'EEXIST') {
        return res.status(409).send('File already exists');
      }
      console.error('Error creating file:', err);
      res.status(500).send('Error creating file');
    }
  });

  router.post('/create-directory', async (req, res) => {
    const { path: relativePath } = req.body;
    if (!relativePath) return res.status(400).json({ error: 'Directory path is required' });

    const targetPath = resolveNotebookPath({ notebookRoot: NOTEBOOK_ROOT, relativePath });
    try {
      await fs.mkdir(targetPath, { recursive: false });
      res.json({ success: true, path: relativePath });
    } catch (err) {
      if (err.code === 'EEXIST') {
        return res.status(409).json({ error: 'Directory already exists' });
      }
      console.error('Error creating directory:', err);
      res.status(500).json({ error: 'Error creating directory' });
    }
  });

  router.post('/delete', async (req, res) => {
    const { path: relativePath } = req.body;
    if (!relativePath) return res.status(400).send('Path is required');

    const normalizedClientPath = normalizeClientPath(relativePath);
    const deletingFromUserSettings = normalizedClientPath === 'UserSettings' || normalizedClientPath.startsWith('UserSettings/');
    const targetPath = deletingFromUserSettings
      ? resolveUserSettingsPath({ userSettingsRoot: USER_SETTINGS_ROOT, relativePath: normalizedClientPath.replace(/^UserSettings\/?/i, '') })
      : resolveNotebookPath({ notebookRoot: NOTEBOOK_ROOT, relativePath: normalizedClientPath });

    try {
      const result = await deleteOrTrashPath({
        notebookRoot: NOTEBOOK_ROOT,
        userSettingsRoot: USER_SETTINGS_ROOT,
        userTrashRoot: USER_TRASH_ROOT,
        relativePath,
        targetPath,
        deletingFromUserSettings,
      });
      res.json({
        success: true,
        originalPath: relativePath,
        permanentlyDeleted: Boolean(result.permanentlyDeleted),
        trashedPath: result.trashedPath,
      });
    } catch (err) {
      if (err?.code === "TRASH_ROOT") {
        return res.status(400).json({ error: err.message });
      }
      console.error('Error moving to trash:', err);
      res.status(500).send('Error moving to trash');
    }
  });

  router.post('/rename', async (req, res) => {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      return res.status(400).send('Both oldPath and newPath are required');
    }

    const src = resolveNotebookPath({ notebookRoot: NOTEBOOK_ROOT, relativePath: oldPath });
    const dest = resolveNotebookPath({ notebookRoot: NOTEBOOK_ROOT, relativePath: newPath });

    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.rename(src, dest);
      res.json({ success: true, oldPath, newPath });
    } catch (err) {
      console.error('Error renaming/moving:', err);
      res.status(500).send('Error renaming/moving');
    }
  });

  router.post('/copy', async (req, res) => {
    const { source, destination } = req.body;
    if (!source || !destination) {
      return res.status(400).send('Both source and destination are required');
    }

    const src = resolveNotebookPath({ notebookRoot: NOTEBOOK_ROOT, relativePath: source });
    const dest = resolveNotebookPath({ notebookRoot: NOTEBOOK_ROOT, relativePath: destination });

    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });

      const stat = await fs.stat(src);
      if (stat.isDirectory()) {
        await fs.cp(src, dest, { recursive: true });
      } else {
        await fs.copyFile(src, dest);
      }

      res.json({ success: true, source, destination });
    } catch (err) {
      console.error('Error copying:', err);
      res.status(500).send('Error copying');
    }
  });

  router.post('/cut', async (req, res) => {
    const { source, destination } = req.body;
    if (!source || !destination) {
      return res.status(400).send('Both source and destination are required');
    }

    const src = resolveNotebookPath({ notebookRoot: NOTEBOOK_ROOT, relativePath: source });
    const dest = resolveNotebookPath({ notebookRoot: NOTEBOOK_ROOT, relativePath: destination });

    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.rename(src, dest);
      res.json({ success: true, source, destination });
    } catch (err) {
      console.error('Error cutting/moving:', err);
      res.status(500).send('Error cutting/moving');
    }
  });

  return router;
}

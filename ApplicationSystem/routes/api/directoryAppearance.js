// Nodevision/ApplicationSystem/routes/api/directoryAppearance.js
// This route exposes Notebook-backed directory appearance data for File Manager and Graph Manager clients.

import express from "express";
import { createServerContext } from "../../shared/serverContext.mjs";
import { rejectIfLanWriteDenied } from "./lanCooperationRoutes.js";
import {
  directoryMetadataPathIsSafe,
  normalizeDirectoryMetadataPath,
  sanitizeDirectoryAppearance,
} from "../../public/GraphManagement/DirectoryAppearanceMetadata.mjs";
import {
  readDirectoryAppearanceManifest,
  saveDirectoryAppearance,
} from "../../server/graph/DirectoryAppearanceNotebookStore.mjs";

const BASE_CONTEXT = createServerContext();

function requestHasPath(container = {}) {
  return Object.prototype.hasOwnProperty.call(container, "path");
}

export default function createDirectoryAppearanceRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();

  router.get("/directory-appearance", async (req, res) => {
    try {
      const manifest = await readDirectoryAppearanceManifest(ctx);
      if (requestHasPath(req.query)) {
        if (!directoryMetadataPathIsSafe(req.query.path)) {
          return res.status(400).json({ error: "Invalid directory path." });
        }
        const path = normalizeDirectoryMetadataPath(req.query.path);
        return res.json({
          path,
          appearance: sanitizeDirectoryAppearance(manifest.directories[path]?.appearance || {}),
        });
      }

      return res.json(manifest);
    } catch (err) {
      console.error("[directoryAppearance] Failed to load directory appearance:", err);
      return res.status(500).json({ error: "Failed to load directory appearance." });
    }
  });

  router.post("/directory-appearance", async (req, res) => {
    if (await rejectIfLanWriteDenied(req, res, ctx)) return;

    try {
      if (!requestHasPath(req.body || {})) {
        return res.status(400).json({ error: "Directory path is required." });
      }
      if (!directoryMetadataPathIsSafe(req.body.path)) {
        return res.status(400).json({ error: "Invalid directory path." });
      }

      const saved = await saveDirectoryAppearance(ctx, req.body.path, req.body.appearance || {}, {
        confirmDirectoryStylesheetUpdate: req.body.confirmDirectoryStylesheetUpdate === true,
      });
      return res.json({ success: true, ...saved });
    } catch (err) {
      if (err?.code === "DIRECTORY_STYLESHEET_CONFIRMATION_REQUIRED") {
        return res.status(err.statusCode || 409).json({
          success: false,
          code: err.code,
          requiresConfirmation: true,
          path: err.directoryPath,
          error: "Nodevision needs permission to update the existing directory.css stylesheet.",
        });
      }
      console.error("[directoryAppearance] Failed to save directory appearance:", err);
      return res.status(500).json({ success: false, error: "Failed to save directory appearance." });
    }
  });

  return router;
}

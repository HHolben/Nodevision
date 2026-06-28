// Nodevision/ApplicationSystem/Templates/TemplateRoutes.mjs
// Express routes for listing, reading, rendering, and creating files from user templates.

import express from "express";
import multer from "multer";
import path from "node:path";
import {
  createFromTemplate,
  listTemplates,
  readTemplate,
  renderTemplate,
  resolveTemplateAssetFile,
  saveNotebookFileAsTemplate,
  saveTemplateBinaryFile,
} from "./TemplateRegistry.mjs";

function sendError(res, err) {
  const status = Number(err?.status || err?.statusCode || 500);
  if (status >= 500) {
    console.error("[templates] Request failed:", err);
  }
  res.status(status).json({ error: err?.message || "Template request failed." });
}

export default function createTemplateRoutes(ctx) {
  const router = express.Router();
  const binaryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 },
  });

  router.get("/templates", async (req, res) => {
    try {
      const templates = await listTemplates(ctx);
      res.json({ templates });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get("/templates/read", async (req, res) => {
    try {
      const template = await readTemplate(req.query.path, ctx);
      res.json({ template });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get("/templates/asset", async (req, res) => {
    try {
      if (!req.identity) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const asset = await resolveTemplateAssetFile(req.query.path, ctx);
      const ext = path.extname(asset.relativePath).toLowerCase();
      const contentType = ext === ".glb"
        ? "model/gltf-binary"
        : ext === ".gltf"
          ? "model/gltf+json"
          : ext === ".json"
            ? "application/json; charset=utf-8"
            : "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.sendFile(asset.absolute);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/templates/render", async (req, res) => {
    try {
      const rendered = await renderTemplate(req.body?.templatePath, req.body?.values || {}, ctx);
      res.json(rendered);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/templates/save", async (req, res) => {
    try {
      const result = await saveNotebookFileAsTemplate(req.body || {}, ctx);
      res.json(result);
    } catch (err) {
      if (err?.code === "EEXIST") {
        err.status = 409;
        err.message = "A template with that name already exists.";
      }
      sendError(res, err);
    }
  });

  router.post("/templates/save-binary", binaryUpload.single("file"), async (req, res) => {
    try {
      if (!req.identity) {
        return res.status(401).json({ error: "Authentication required." });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "A .glb file upload is required." });
      }
      const result = await saveTemplateBinaryFile({
        targetPath: req.body?.targetPath,
        fileBuffer: req.file.buffer,
      }, ctx);
      res.json(result);
    } catch (err) {
      if (err?.code === "EEXIST") {
        err.status = 409;
        err.message = "A file with that name already exists.";
      }
      sendError(res, err);
    }
  });

  router.post("/templates/create", async (req, res) => {
    try {
      const result = await createFromTemplate(req.body || {}, ctx);
      res.json(result);
    } catch (err) {
      if (err?.code === "EEXIST") {
        err.status = 409;
        err.message = "A file with that name already exists.";
      }
      sendError(res, err);
    }
  });

  return router;
}


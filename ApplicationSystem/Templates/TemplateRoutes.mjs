// Nodevision/ApplicationSystem/Templates/TemplateRoutes.mjs
// Express routes for listing, reading, rendering, and creating files from user templates.

import express from "express";
import {
  createFromTemplate,
  listTemplates,
  readTemplate,
  renderTemplate,
  saveNotebookFileAsTemplate,
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


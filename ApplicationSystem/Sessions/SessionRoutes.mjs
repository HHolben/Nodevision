// Nodevision/ApplicationSystem/Sessions/SessionRoutes.mjs
// This module exposes authenticated local API routes for listing, reading, creating, duplicating, saving, and deleting Nodevision Sessions.

import express from "express";
import {
  createUserSession,
  deleteUserSession,
  duplicateBuiltInSession,
  listSessions,
  readSession,
  saveUserSession,
} from "./SessionRegistry.mjs";

function sendError(res, err) {
  const status = Number(err?.status || err?.statusCode || 500);
  if (status >= 500) console.error("[sessions] Request failed:", err);
  res.status(status).json({ error: err?.message || "Session request failed." });
}

function requireIdentity(req, res, next) {
  if (!req.identity) return res.status(401).json({ error: "Authentication required." });
  next();
}

export default function createSessionRoutes(ctx) {
  const router = express.Router();
  router.use("/sessions", requireIdentity);

  router.get("/sessions", async (req, res) => {
    try {
      res.json(await listSessions(ctx));
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get("/sessions/read", async (req, res) => {
    try {
      res.json({ session: await readSession(req.query.scope, req.query.id, ctx) });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/sessions/create", async (req, res) => {
    try {
      res.json({ session: await createUserSession(req.body || {}, ctx) });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/sessions/save", async (req, res) => {
    try {
      res.json({ session: await saveUserSession(req.body?.id, req.body?.source, ctx) });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/sessions/duplicate-builtin", async (req, res) => {
    try {
      res.json({ session: await duplicateBuiltInSession(req.body?.id, req.body?.name, ctx) });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete("/sessions", async (req, res) => {
    try {
      res.json(await deleteUserSession(req.query.id, ctx));
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}


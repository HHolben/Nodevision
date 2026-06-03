// Nodevision/ApplicationSystem/routes/api/test-arduino-flash-routes.mjs
// Smoke test: Arduino Flash API routes mount under /api and status returns JSON, not 404.

import assert from "node:assert/strict";
import express from "express";
import createArduinoFlashRouter from "./arduinoFlashRoutes.js";
import { createServerContext } from "../../shared/serverContext.mjs";

const app = express();
app.use(express.json());
app.use("/api", createArduinoFlashRouter(createServerContext()));

const server = app.listen(0);
try {
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/arduino-flash/status`);

  assert.notEqual(response.status, 404, "Arduino Flash status route must not return 404");
  assert.match(response.headers.get("content-type") || "", /json/i, "status route should return JSON");

  const body = await response.json();
  assert.equal(typeof body, "object", "status route should return a JSON object");
  console.log("Arduino Flash route smoke test passed", { status: response.status, body });
} finally {
  await new Promise((resolve) => server.close(resolve));
}

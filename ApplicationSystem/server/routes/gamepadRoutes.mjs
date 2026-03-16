// Nodevision/ApplicationSystem/server/routes/gamepadRoutes.mjs
// This file exposes endpoints for reading and writing gamepad settings so that clients can persist controller mappings between sessions.

import fs from "node:fs";
import fsPromises from "node:fs/promises";

export function registerGamepadRoutes(app, ctx) {
  const gamepadSettingsFile = ctx.gamepadSettingsFile;

  app.get("/api/load-gamepad-settings", async (req, res) => {
    try {
      if (!fs.existsSync(gamepadSettingsFile)) return res.json({});
      const data = await fsPromises.readFile(gamepadSettingsFile, "utf8");
      res.json(JSON.parse(data));
    } catch (err) {
      console.error("Error reading gamepad settings:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/save-gamepad-settings", async (req, res) => {
    try {
      await fsPromises.writeFile(gamepadSettingsFile, JSON.stringify(req.body, null, 2), "utf8");
      res.json({ success: true });
    } catch (err) {
      console.error("Error saving gamepad settings:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}


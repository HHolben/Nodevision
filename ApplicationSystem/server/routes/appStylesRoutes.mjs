// Nodevision/ApplicationSystem/server/routes/appStylesRoutes.mjs
// This file defines App Styles routes for selecting and applying UserSettings stylesheet presets.

import path from "node:path";
import fsPromises from "node:fs/promises";

const ACTIVE_STYLES_FILE = "UserStyles.css";
const DEFAULT_STYLES_FILE = "DefaultUserStyles.css";

const FALLBACK_DEFAULT_STYLES =
  `/* Auto-generated default user styles */\nbody {\n  background-color: #ffffff;\n}\n`;

function toSafeFileName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const base = path.basename(raw);
  if (base !== raw) return "";
  if (!base.toLowerCase().endsWith(".css")) return "";
  return base;
}

async function ensureDefaultStylesFile(userSettingsDir) {
  const activePath = path.join(userSettingsDir, ACTIVE_STYLES_FILE);
  const defaultPath = path.join(userSettingsDir, DEFAULT_STYLES_FILE);

  try {
    await fsPromises.access(defaultPath);
    return;
  } catch {
    // If missing, copy from active styles when available.
  }

  try {
    const activeCss = await fsPromises.readFile(activePath, "utf8");
    await fsPromises.writeFile(defaultPath, activeCss, "utf8");
  } catch {
    await fsPromises.writeFile(defaultPath, FALLBACK_DEFAULT_STYLES, "utf8");
  }
}

async function listCssFiles(userSettingsDir) {
  const entries = await fsPromises.readdir(userSettingsDir, {
    withFileTypes: true,
  });
  const cssFiles = entries
    .filter((entry) =>
      entry.isFile() && entry.name.toLowerCase().endsWith(".css")
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  return cssFiles;
}

function toStyleDescriptor(fileName) {
  const name = String(fileName || "");
  if (name === ACTIVE_STYLES_FILE) {
    return {
      fileName: name,
      label: "Active User Styles",
      kind: "active",
    };
  }
  if (name === DEFAULT_STYLES_FILE) {
    return {
      fileName: name,
      label: "Default App Styles",
      kind: "default",
    };
  }
  return {
    fileName: name,
    label: name.replace(/\.css$/i, ""),
    kind: "preset",
  };
}

async function copyFileAtomic(sourcePath, targetPath) {
  const css = await fsPromises.readFile(sourcePath, "utf8");
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  await fsPromises.writeFile(tempPath, css, "utf8");
  await fsPromises.rename(tempPath, targetPath);
}

export function registerAppStylesRoutes(app, ctx) {
  const userSettingsDir = ctx.userSettingsDir;

  app.get("/api/app-styles", async (req, res) => {
    try {
      await fsPromises.mkdir(userSettingsDir, { recursive: true });
      await ensureDefaultStylesFile(userSettingsDir);
      const cssFiles = await listCssFiles(userSettingsDir);

      // Ensure active stylesheet is present in metadata even if missing on disk.
      const withActive = cssFiles.includes(ACTIVE_STYLES_FILE)
        ? cssFiles
        : [ACTIVE_STYLES_FILE, ...cssFiles];

      const styles = withActive.map(toStyleDescriptor);
      res.json({
        activeFileName: ACTIVE_STYLES_FILE,
        styles,
      });
    } catch (err) {
      console.error("Error loading app styles:", err);
      res.status(500).json({
        success: false,
        error: "Failed to load app styles",
      });
    }
  });

  app.post("/api/app-styles/apply", async (req, res) => {
    try {
      await fsPromises.mkdir(userSettingsDir, { recursive: true });
      await ensureDefaultStylesFile(userSettingsDir);

      const sourceFileName = toSafeFileName(req.body?.sourceFileName);
      if (!sourceFileName) {
        return res.status(400).json({
          success: false,
          error: "sourceFileName is required",
        });
      }

      const sourcePath = path.join(userSettingsDir, sourceFileName);
      const targetPath = path.join(userSettingsDir, ACTIVE_STYLES_FILE);

      try {
        await fsPromises.access(sourcePath);
      } catch {
        return res.status(404).json({
          success: false,
          error: "Style preset not found",
        });
      }

      if (sourceFileName !== ACTIVE_STYLES_FILE) {
        await copyFileAtomic(sourcePath, targetPath);
      }

      res.json({
        success: true,
        sourceFileName,
        activeFileName: ACTIVE_STYLES_FILE,
      });
    } catch (err) {
      console.error("Error applying app style:", err);
      res.status(500).json({
        success: false,
        error: "Failed to apply app style",
      });
    }
  });
}

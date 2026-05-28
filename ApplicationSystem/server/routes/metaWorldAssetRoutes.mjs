// Nodevision/ApplicationSystem/server/routes/metaWorldAssetRoutes.mjs
// This file registers secure asset discovery and hidden Meta World import endpoints for Notebook assets.

import path from "node:path";
import fs from "node:fs/promises";
import * as cheerio from "cheerio";

import { validateAndNormalizePath } from "../pathUtils.mjs";

const SUPPORTED_EXTENSIONS = new Map([
  [".glb", "model"], [".gltf", "model"], [".obj", "model"], [".stl", "model"],
  [".png", "billboard"], [".jpg", "billboard"], [".jpeg", "billboard"], [".svg", "billboard"], [".webp", "billboard"],
  [".mp3", "audio"], [".wav", "audio"], [".ogg", "audio"],
  [".mp4", "video"], [".webm", "video"],
]);

function notebookRelative(rawPath = "") {
  const clean = String(rawPath)
    .replace(/\0/g, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "")
    .replace(/^Notebook\//i, "");
  return clean.split("/").filter(Boolean).join("/");
}

function notebookUrl(relPath) {
  return `/Notebook/${relPath.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function assetKind(fileName) {
  return SUPPORTED_EXTENSIONS.get(path.extname(fileName).toLowerCase()) || null;
}

function defaultObjectForAsset(assetPath, placement = "origin") {
  const kind = assetKind(assetPath);
  const atTarget = placement === "camera-target";
  const base = {
    type: "asset",
    assetType: kind,
    src: notebookUrl(assetPath),
    position: kind === "billboard" ? [0, 1.5, atTarget ? -3 : 0] : [0, 0, atTarget ? -3 : 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
  if (kind === "model") return { ...base, collidable: true };
  if (kind === "billboard") return { ...base, alwaysFaceCamera: true, collidable: false };
  if (kind === "audio") return { ...base, collidable: false, autoplay: false, loop: false };
  if (kind === "video") return { ...base, collidable: false, autoplay: false, loop: false };
  return base;
}

function stripJsonComments(value) {
  return String(value || "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").trim();
}

function defaultWorld(fileName) {
  return {
    version: 1,
    worldType: "NodevisionMetaWorld",
    name: path.basename(fileName || "Meta World"),
    type: "meta-world",
    objects: [],
  };
}

function findWorldScript($) {
  return $('script[data-nodevision-meta-world], script#nodevision-metaworld, script[type="application/json"]').first();
}

async function ensureLocalAssetMetadata(assetFsPath, assetRelPath) {
  const metadataPath = `${assetFsPath}.metadata.json`;
  try {
    await fs.access(metadataPath);
    return;
  } catch {
    const metadata = {
      title: path.basename(assetRelPath),
      source: "local Notebook",
      license: "unknown",
      tags: [],
      importedAt: new Date().toISOString(),
    };
    await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  }
}

async function walkAssets(rootDir, dir = "", results = []) {
  const fullDir = validateAndNormalizePath(dir, rootDir);
  const entries = await fs.readdir(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await walkAssets(rootDir, rel, results);
    } else if (entry.isFile()) {
      const kind = assetKind(entry.name);
      if (!kind) continue;
      results.push({
        name: entry.name,
        type: kind,
        path: notebookUrl(rel),
        notebookPath: rel,
        extension: path.extname(entry.name).toLowerCase(),
      });
    }
  }
  return results;
}

export function registerMetaWorldAssetRoutes(app, ctx) {
  const NOTEBOOK_DIR = ctx.notebookDir;

  app.get("/api/meta-world/assets", async (req, res) => {
    try {
      const assets = await walkAssets(NOTEBOOK_DIR);
      assets.sort((a, b) => a.notebookPath.localeCompare(b.notebookPath));
      res.json({ assets });
    } catch (err) {
      res.status(500).json({ error: "Failed to list Notebook assets", details: err?.message || "Unknown error" });
    }
  });

  app.post("/api/meta-world/import-asset", async (req, res) => {
    const worldRel = notebookRelative(req.body?.worldPath);
    const assetRel = notebookRelative(req.body?.assetPath);
    const placement = req.body?.placement === "camera-target" ? "camera-target" : "origin";

    try {
      if (!worldRel || !/\.html?$/i.test(worldRel)) {
        return res.status(400).json({ error: "Select an HTML world file first." });
      }
      if (!assetRel || !assetKind(assetRel)) {
        return res.status(400).json({ error: "Unsupported or missing asset path." });
      }

      const worldFsPath = validateAndNormalizePath(worldRel, NOTEBOOK_DIR);
      const assetFsPath = validateAndNormalizePath(assetRel, NOTEBOOK_DIR);
      await fs.access(assetFsPath);

      const html = await fs.readFile(worldFsPath, "utf8");
      const $ = cheerio.load(html, { decodeEntities: false });
      const script = findWorldScript($);
      let world = defaultWorld(worldRel);

      if (script.length) {
        const parsed = JSON.parse(stripJsonComments(script.html()));
        world = { ...defaultWorld(worldRel), ...(parsed && typeof parsed === "object" ? parsed : {}) };
      }
      if (!Array.isArray(world.objects)) world.objects = [];
      const object = defaultObjectForAsset(assetRel, placement);
      world.objects.push(object);
      // TODO: Feed object.src values into the graph edge extractor when Meta World dependency edges are centralized.

      const json = `\n${JSON.stringify(world, null, 2)}\n`;
      if (script.length) {
        script.attr("type", "application/json");
        script.attr("id", script.attr("id") || "nodevision-metaworld");
        script.attr("data-nodevision-meta-world", "");
        script.text(json);
      } else {
        const block = `<script id="nodevision-metaworld" type="application/json" data-nodevision-meta-world>${json}</script>`;
        if ($("body").length) $("body").append(`\n${block}\n`);
        else $.root().append(`\n${block}\n`);
      }

      await fs.writeFile(worldFsPath, $.html(), "utf8");
      await ensureLocalAssetMetadata(assetFsPath, assetRel);
      res.json({ success: true, object, worldPath: worldRel, assetPath: assetRel });
    } catch (err) {
      const denied = /outside allowed directory/i.test(err?.message || "");
      res.status(denied ? 403 : 500).json({
        error: denied ? "Path outside Notebook is not allowed." : "Failed to import asset into Meta World.",
        details: err?.message || "Unknown error",
      });
    }
  });
}

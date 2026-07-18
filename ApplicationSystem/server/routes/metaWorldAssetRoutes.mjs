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

const CHARACTER_SCRIPT_SELECTOR = 'script#nodevision-character[type="application/nodevision-character+json"], script#nodevision-character, script[type="application/nodevision-character+json"]';
const CHARACTER_MODEL_EXTENSIONS = new Set([".glb", ".gltf"]);
const CHARACTER_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg", ".webp"]);

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

function slugify(value, fallback = "item") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function summarizeCharacter(character, relPath = "") {
  const levelValue = Number(character?.level?.value);
  return {
    id: typeof character?.id === "string" && character.id.trim() ? character.id.trim() : slugify(character?.name || path.basename(relPath), "character"),
    name: typeof character?.name === "string" && character.name.trim() ? character.name.trim() : path.basename(relPath),
    sex: typeof character?.sex === "string" && character.sex.trim() ? character.sex.trim() : "Not Applicable",
    level: Number.isFinite(levelValue) ? levelValue : 0,
    kind: character?.kind || "NodevisionCharacter",
    assets: character?.assets && typeof character.assets === "object" ? character.assets : {},
  };
}

function findWorldScript($) {
  return $('script[data-nodevision-meta-world], script#nodevision-metaworld, script[type="application/json"]').first();
}

function findCharacterScript($) {
  return $(CHARACTER_SCRIPT_SELECTOR).first();
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

function visualAssetForCharacter(character) {
  const assets = character?.assets && typeof character.assets === "object" ? character.assets : {};
  const candidates = [
    { path: assets.avatar3D, assetType: "model" },
    { path: assets.spriteTopDown, assetType: "billboard" },
    { path: assets.spriteSideScroll, assetType: "billboard" },
  ];

  for (const candidate of candidates) {
    const rel = notebookRelative(candidate.path || "");
    if (!rel) continue;
    const ext = path.extname(rel).toLowerCase();
    if (candidate.assetType === "model" && CHARACTER_MODEL_EXTENSIONS.has(ext)) return { ...candidate, path: rel };
    if (candidate.assetType === "billboard" && CHARACTER_IMAGE_EXTENSIONS.has(ext)) return { ...candidate, path: rel };
  }
  return null;
}

function characterPlacement(visual, placement = "origin") {
  const atTarget = placement === "camera-target";
  if (visual?.assetType === "model") return [0, 0, atTarget ? -3 : 0];
  return [0, 1.4, atTarget ? -3 : 0];
}

function defaultObjectForCharacter(characterPath, character, placement = "origin", role = "npc") {
  const summary = summarizeCharacter(character, characterPath);
  const visual = visualAssetForCharacter(character);
  const suffix = Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000).toString(36);
  const id = `character-${slugify(summary.id || summary.name, "character")}-${suffix}`;
  const characterRef = {
    mode: "wiki",
    source: characterPath,
    role,
    id: summary.id,
    name: summary.name,
    sex: summary.sex,
    level: summary.level,
    kind: "NodevisionCharacter",
  };
  const base = {
    id,
    tag: id,
    name: summary.name,
    position: characterPlacement(visual, placement),
    character: characterRef,
    characterSource: characterPath,
    nodevisionCharacter: characterRef,
    collidable: false,
    isSolid: false,
    breakable: false,
  };

  if (visual?.assetType === "model") {
    return {
      ...base,
      type: "asset",
      assetType: "model",
      src: notebookUrl(visual.path),
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
  }

  if (visual?.assetType === "billboard") {
    return {
      ...base,
      type: "asset",
      assetType: "billboard",
      src: notebookUrl(visual.path),
      rotation: [0, 0, 0],
      scale: [1.2, 1.8, 1],
      alwaysFaceCamera: true,
    };
  }

  return {
    ...base,
    type: "label",
    text: summary.name,
    label: summary.name,
    scale: 1,
    color: "#1f2937",
    backgroundColor: "rgba(241, 245, 249, 0.92)",
  };
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
    metadata: {
      environment: {
        skyColor: "#ffffff",
        floorColor: "#d8dee4",
        backgroundMode: "color",
        backgroundImage: "",
        dayNightCycle: {
          enabled: false,
          durationSeconds: 120,
          periods: [
            { time: 0, brightness: 1 }
          ]
        }
      },
    },
    environment: {
      skyColor: "#ffffff",
      floorColor: "#d8dee4",
      backgroundMode: "color",
      backgroundImage: "",
      dayNightCycle: {
        enabled: false,
        durationSeconds: 120,
        periods: [
          { time: 0, brightness: 1 }
        ]
      }
    },
    objects: [],
  };
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

async function readCharacterPage(characterFsPath, characterRelPath) {
  const html = await fs.readFile(characterFsPath, "utf8");
  const $ = cheerio.load(html, { decodeEntities: false });
  const script = findCharacterScript($);
  if (!script.length) return null;

  const parsed = JSON.parse(script.html() || script.text() || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Character JSON must be an object.");
  }
  if (parsed.kind !== "NodevisionCharacter") {
    throw new Error(`${characterRelPath} is not a NodevisionCharacter page.`);
  }
  return parsed;
}

async function readWorldDefinition(worldFsPath, worldRelPath) {
  const html = await fs.readFile(worldFsPath, "utf8");
  const $ = cheerio.load(html, { decodeEntities: false });
  const script = findWorldScript($);
  let world = defaultWorld(worldRelPath);

  if (script.length) {
    const parsed = JSON.parse(stripJsonComments(script.html()));
    world = { ...defaultWorld(worldRelPath), ...(parsed && typeof parsed === "object" ? parsed : {}) };
  }

  return { html, $, script, world };
}

async function writeWorldDefinition(worldFsPath, $, script, world) {
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

async function walkCharacters(rootDir, dir = "", results = []) {
  const fullDir = validateAndNormalizePath(dir, rootDir);
  const entries = await fs.readdir(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await walkCharacters(rootDir, rel, results);
      continue;
    }
    if (!entry.isFile() || !/\.html?$/i.test(entry.name)) continue;

    try {
      const characterFsPath = validateAndNormalizePath(rel, rootDir);
      const character = await readCharacterPage(characterFsPath, rel);
      if (!character) continue;
      const summary = summarizeCharacter(character, rel);
      results.push({
        ...summary,
        type: "character",
        path: notebookUrl(rel),
        notebookPath: rel,
        extension: path.extname(entry.name).toLowerCase(),
      });
    } catch {
      // Ignore malformed character candidates in the asset picker.
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

  app.get("/api/meta-world/characters", async (req, res) => {
    try {
      const characters = await walkCharacters(NOTEBOOK_DIR);
      characters.sort((a, b) => a.name.localeCompare(b.name) || a.notebookPath.localeCompare(b.notebookPath));
      res.json({ characters });
    } catch (err) {
      res.status(500).json({ error: "Failed to list Notebook characters", details: err?.message || "Unknown error" });
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

      const { $, script, world } = await readWorldDefinition(worldFsPath, worldRel);
      if (!Array.isArray(world.objects)) world.objects = [];
      const object = defaultObjectForAsset(assetRel, placement);
      world.objects.push(object);
      // TODO: Feed object.src values into the graph edge extractor when Meta World dependency edges are centralized.

      await writeWorldDefinition(worldFsPath, $, script, world);
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

  app.post("/api/meta-world/import-character", async (req, res) => {
    const worldRel = notebookRelative(req.body?.worldPath);
    const characterRel = notebookRelative(req.body?.characterPath);
    const placement = req.body?.placement === "camera-target" ? "camera-target" : "origin";
    const role = req.body?.role === "playable" ? "playable" : "npc";

    try {
      if (!worldRel || !/\.html?$/i.test(worldRel)) {
        return res.status(400).json({ error: "Select an HTML world file first." });
      }
      if (!characterRel || !/\.html?$/i.test(characterRel)) {
        return res.status(400).json({ error: "Select a character wiki HTML page first." });
      }

      const worldFsPath = validateAndNormalizePath(worldRel, NOTEBOOK_DIR);
      const characterFsPath = validateAndNormalizePath(characterRel, NOTEBOOK_DIR);
      await fs.access(characterFsPath);

      const character = await readCharacterPage(characterFsPath, characterRel);
      if (!character) return res.status(400).json({ error: "Selected page does not contain nodevision-character JSON." });

      const { $, script, world } = await readWorldDefinition(worldFsPath, worldRel);
      if (!Array.isArray(world.objects)) world.objects = [];
      if (!Array.isArray(world.characters)) world.characters = [];

      const object = defaultObjectForCharacter(characterRel, character, placement, role);
      world.objects.push(object);
      world.characters.push({
        ...object.character,
        objectId: object.id,
      });

      await writeWorldDefinition(worldFsPath, $, script, world);
      res.json({ success: true, object, character: object.character, worldPath: worldRel, characterPath: characterRel });
    } catch (err) {
      const denied = /outside allowed directory/i.test(err?.message || "");
      res.status(denied ? 403 : 500).json({
        error: denied ? "Path outside Notebook is not allowed." : "Failed to import character into Meta World.",
        details: err?.message || "Unknown error",
      });
    }
  });
}

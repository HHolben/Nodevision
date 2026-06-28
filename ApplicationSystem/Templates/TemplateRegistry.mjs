// Nodevision/ApplicationSystem/Templates/TemplateRegistry.mjs
// This module owns safe discovery, reading, rendering, and Notebook writes for user templates.

import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { createServerContext } from "../shared/serverContext.mjs";
import { parseFormTemplate, renderTemplateContent } from "./TemplateRenderer.mjs";

const BASE_CONTEXT = createServerContext();
const FORM_TEMPLATE_SUFFIX = ".template.html";
const RAW_TEMPLATE_DIR = "RawTemplates";
const FORM_TEMPLATE_DIR = "FormTemplates";
const TEXT_EXTENSIONS = new Set([
  "bat", "c", "cc", "cpp", "css", "csv", "h", "hpp", "htm", "html", "ino",
  "java", "js", "json", "jsx", "kml", "latex", "log", "md", "mjs", "php",
  "py", "scad", "svg", "tex", "text", "ts", "tsx", "txt", "xml", "yaml", "yml",
]);

export function getTemplateRoot(ctx = BASE_CONTEXT) {
  return path.join(ctx.userDataDir, "UserTemplates");
}

export function getRawTemplateRoot(ctx = BASE_CONTEXT) {
  return path.join(getTemplateRoot(ctx), RAW_TEMPLATE_DIR);
}

export function getFormTemplateRoot(ctx = BASE_CONTEXT) {
  return path.join(getTemplateRoot(ctx), FORM_TEMPLATE_DIR);
}

function isWithin(parentDir, childPath) {
  const relative = path.relative(parentDir, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function cleanRelativePath(value, label = "Path") {
  const raw = String(value ?? "");
  if (!raw.trim()) {
    const err = new Error(`${label} is required.`);
    err.status = 400;
    throw err;
  }
  if (raw.includes("\0")) {
    const err = new Error(`${label} contains invalid characters.`);
    err.status = 400;
    throw err;
  }

  const slashNormalized = raw.replace(/\\/g, "/").trim();
  if (path.isAbsolute(slashNormalized) || slashNormalized.startsWith("/") || /^[a-z]:\//i.test(slashNormalized)) {
    const err = new Error(`${label} must be relative.`);
    err.status = 400;
    throw err;
  }

  const normalized = path.posix.normalize(slashNormalized).replace(/^\.\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.includes("..")) {
    const err = new Error(`${label} cannot traverse outside its root.`);
    err.status = 400;
    throw err;
  }
  return parts.join("/");
}

function cleanNotebookDirectory(value = "") {
  const raw = String(value ?? "").replace(/\\/g, "/").trim().replace(/^\/+/, "");
  const withoutPrefix = raw.replace(/^Notebook\/?/i, "");
  if (!withoutPrefix) return "";
  return cleanRelativePath(withoutPrefix, "Destination directory");
}

function cleanNotebookFilePath(value, label = "Source file") {
  const raw = String(value ?? "").replace(/\\/g, "/").trim().replace(/^\/+/, "");
  const withoutPrefix = raw.replace(/^Notebook\/?/i, "");
  return cleanRelativePath(withoutPrefix, label);
}

function cleanFilename(value, outputExtension = "") {
  const raw = String(value ?? "").trim();
  if (!raw) {
    const err = new Error("Destination filename is required.");
    err.status = 400;
    throw err;
  }
  if (raw.includes("\0") || raw.includes("/") || raw.includes("\\") || raw === "." || raw === "..") {
    const err = new Error("Destination filename must be a file name, not a path.");
    err.status = 400;
    throw err;
  }
  if (/^[a-z]:/i.test(raw)) {
    const err = new Error("Destination filename must not include a drive prefix.");
    err.status = 400;
    throw err;
  }

  const ext = String(outputExtension || "").replace(/^\.+/, "").trim();
  if (ext && !path.extname(raw)) return `${raw}.${ext}`;
  return raw;
}

function resolveInside(root, relativePath, label) {
  const clean = cleanRelativePath(relativePath, label);
  const absolute = path.resolve(root, clean);
  if (!isWithin(root, absolute)) {
    const err = new Error(`${label} is outside the allowed directory.`);
    err.status = 403;
    throw err;
  }
  return { clean, absolute };
}

function resolveNotebookDestination(ctx, destinationDirectory, filename, outputExtension) {
  const directory = cleanNotebookDirectory(destinationDirectory);
  const cleanName = cleanFilename(filename, outputExtension);
  const absoluteDir = directory ? path.resolve(ctx.notebookDir, directory) : ctx.notebookDir;
  const absolute = path.resolve(absoluteDir, cleanName);

  if (!isWithin(ctx.notebookDir, absoluteDir) || !isWithin(ctx.notebookDir, absolute)) {
    const err = new Error("Destination must stay inside the Notebook.");
    err.status = 403;
    throw err;
  }

  const relativePath = path.relative(ctx.notebookDir, absolute).split(path.sep).join("/");
  return { absolute, relativePath, directory, filename: cleanName };
}

function resolveNotebookSource(ctx, sourcePath) {
  const relativePath = cleanNotebookFilePath(sourcePath, "Source file");
  const absolute = path.resolve(ctx.notebookDir, relativePath);

  if (!isWithin(ctx.notebookDir, absolute)) {
    const err = new Error("Source file must stay inside the Notebook.");
    err.status = 403;
    throw err;
  }

  return { absolute, relativePath };
}

async function assertNotebookAncestorIsSafe(ctx, targetDir) {
  const notebookReal = await fs.realpath(ctx.notebookDir);
  let current = path.resolve(targetDir);
  while (true) {
    try {
      const real = await fs.realpath(current);
      if (!isWithin(notebookReal, real)) {
        const err = new Error("Destination must stay inside the Notebook.");
        err.status = 403;
        throw err;
      }
      return;
    } catch (err) {
      if (err?.status) throw err;
      if (err?.code !== "ENOENT") throw err;
      const parent = path.dirname(current);
      if (parent === current) throw err;
      current = parent;
    }
  }
}

async function assertNotebookParentIsSafe(ctx, destination) {
  const notebookReal = await fs.realpath(ctx.notebookDir);
  const parentReal = await fs.realpath(path.dirname(destination.absolute));
  if (!isWithin(notebookReal, parentReal)) {
    const err = new Error("Destination must stay inside the Notebook.");
    err.status = 403;
    throw err;
  }
}

function stripFormSuffix(filename) {
  return filename.toLowerCase().endsWith(FORM_TEMPLATE_SUFFIX)
    ? filename.slice(0, -FORM_TEMPLATE_SUFFIX.length)
    : filename;
}

function isFormTemplateFilename(value) {
  return path.posix.basename(String(value || "").replace(/\\/g, "/")).toLowerCase().endsWith(FORM_TEMPLATE_SUFFIX);
}

function getTemplateBucket(relativePath) {
  const first = String(relativePath || "").replace(/\\/g, "/").split("/").filter(Boolean)[0] || "";
  if (first.toLowerCase() === RAW_TEMPLATE_DIR.toLowerCase()) return "raw";
  if (first.toLowerCase() === FORM_TEMPLATE_DIR.toLowerCase()) return "form";
  return "legacy";
}

function stripTemplateBucket(relativePath) {
  const parts = String(relativePath || "").replace(/\\/g, "/").split("/").filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0].toLowerCase();
  if (first === RAW_TEMPLATE_DIR.toLowerCase() || first === FORM_TEMPLATE_DIR.toLowerCase()) {
    return parts.slice(1).join("/") || parts[0];
  }
  return parts.join("/");
}

function titleFromTemplatePath(relativePath) {
  const displayPath = stripTemplateBucket(relativePath);
  const directory = path.posix.dirname(displayPath);
  const base = path.posix.basename(displayPath);
  const withoutTemplateSuffix = stripFormSuffix(base);
  const withoutExtension = withoutTemplateSuffix.replace(/\.[^.]+$/, "");
  if (!directory || directory === ".") return withoutExtension || base;
  return `${directory.split("/").join(" / ")} / ${withoutExtension || base}`;
}

function getKind(relativePath) {
  const bucket = getTemplateBucket(relativePath);
  if (bucket === "form") return "form";
  if (bucket === "raw") return "file";
  return relativePath.toLowerCase().endsWith(FORM_TEMPLATE_SUFFIX) ? "form" : "file";
}

function getRawExtension(relativePath) {
  if (getKind(relativePath) === "form") return "template.html";
  return path.extname(relativePath).replace(/^\./, "").toLowerCase();
}

function getDefaultOutputExtension(relativePath) {
  if (getKind(relativePath) === "form") return "html";
  return getRawExtension(relativePath);
}

function looksBinary(buffer) {
  if (!buffer || buffer.length === 0) return false;
  let suspicious = 0;
  const sampleLen = Math.min(buffer.length, 4096);
  for (let i = 0; i < sampleLen; i += 1) {
    const byte = buffer[i];
    if (byte === 0) return true;
    if (byte < 7 || (byte > 14 && byte < 32)) suspicious += 1;
  }
  return suspicious / sampleLen > 0.2;
}

function shouldTreatAsText(relativePath, buffer) {
  const ext = getRawExtension(relativePath);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  return !looksBinary(buffer);
}

async function readFormOutputExtension(absolutePath) {
  try {
    const html = await fs.readFile(absolutePath, "utf8");
    return parseFormTemplate(html).outputExtension;
  } catch {
    return "html";
  }
}

async function createMetadata(root, absolutePath) {
  const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
  const kind = getKind(relativePath);
  const outputExtension = kind === "form"
    ? await readFormOutputExtension(absolutePath)
    : getDefaultOutputExtension(relativePath);

  return {
    displayName: titleFromTemplatePath(relativePath),
    relativePath,
    bucket: getTemplateBucket(relativePath),
    extension: getRawExtension(relativePath),
    kind,
    outputExtension,
  };
}

async function scanDirectory(root, directory, found) {
  let entries = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return;
    throw err;
  }

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (!isWithin(root, absolute)) continue;
    if (entry.isDirectory()) {
      await scanDirectory(root, absolute, found);
      continue;
    }
    if (!entry.isFile()) continue;
    found.push(await createMetadata(root, absolute));
  }
}

export async function listTemplates(ctx = BASE_CONTEXT) {
  const root = getTemplateRoot(ctx);
  await fs.mkdir(getRawTemplateRoot(ctx), { recursive: true });
  await fs.mkdir(getFormTemplateRoot(ctx), { recursive: true });
  const templates = [];
  await scanDirectory(root, root, templates);
  templates.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.relativePath.localeCompare(b.relativePath));
  return templates;
}

export async function resolveTemplateAssetFile(relativePath, ctx = BASE_CONTEXT) {
  const root = getTemplateRoot(ctx);
  const resolved = resolveInside(root, relativePath, "Template asset path");
  const stat = await fs.lstat(resolved.absolute);
  if (!stat.isFile()) {
    const err = new Error("Template asset path must point to a file.");
    err.status = 400;
    throw err;
  }
  return {
    absolute: resolved.absolute,
    relativePath: resolved.clean,
    size: stat.size,
  };
}

export async function readTemplate(relativePath, ctx = BASE_CONTEXT) {
  const root = getTemplateRoot(ctx);
  const resolved = resolveInside(root, relativePath, "Template path");
  const stat = await fs.lstat(resolved.absolute);
  if (!stat.isFile()) {
    const err = new Error("Template path must point to a file.");
    err.status = 400;
    throw err;
  }

  const metadata = await createMetadata(root, resolved.absolute);
  const buffer = await fs.readFile(resolved.absolute);

  if (metadata.kind === "form") {
    const content = buffer.toString("utf8");
    const parsed = parseFormTemplate(content);
    return {
      ...metadata,
      form: {
        fields: parsed.fields,
        outputExtension: parsed.outputExtension,
      },
      content,
      isBinary: false,
    };
  }

  const isText = shouldTreatAsText(metadata.relativePath, buffer);
  return {
    ...metadata,
    content: isText ? buffer.toString("utf8") : "",
    isBinary: !isText,
    size: buffer.length,
  };
}

export async function renderTemplate(relativePath, values = {}, ctx = BASE_CONTEXT) {
  const root = getTemplateRoot(ctx);
  const resolved = resolveInside(root, relativePath, "Template path");
  if (getKind(resolved.clean) !== "form") {
    const err = new Error("Only .template.html templates can be rendered.");
    err.status = 400;
    throw err;
  }
  const stat = await fs.lstat(resolved.absolute);
  if (!stat.isFile()) {
    const err = new Error("Template path must point to a file.");
    err.status = 400;
    throw err;
  }
  const html = await fs.readFile(resolved.absolute, "utf8");
  return renderTemplateContent(html, values);
}

export async function createFromTemplate(options = {}, ctx = BASE_CONTEXT) {
  const {
    templatePath,
    destinationDirectory = "",
    filename,
    values = {},
  } = options;

  const template = await readTemplate(templatePath, ctx);
  const destination = resolveNotebookDestination(
    ctx,
    destinationDirectory,
    filename,
    template.outputExtension,
  );

  const destinationParent = path.dirname(destination.absolute);
  await assertNotebookAncestorIsSafe(ctx, destinationParent);
  await fs.mkdir(destinationParent, { recursive: true });
  await assertNotebookParentIsSafe(ctx, destination);

  if (template.kind === "form") {
    const rendered = await renderTemplate(template.relativePath, values, ctx);
    await fs.writeFile(destination.absolute, rendered.content, { flag: "wx" });
    return {
      success: true,
      path: destination.relativePath,
      template,
      outputExtension: rendered.outputExtension,
    };
  }

  const templateRoot = getTemplateRoot(ctx);
  const source = resolveInside(templateRoot, template.relativePath, "Template path");
  await fs.copyFile(source.absolute, destination.absolute, fsConstants.COPYFILE_EXCL);
  return {
    success: true,
    path: destination.relativePath,
    template,
    outputExtension: template.outputExtension,
  };
}


export function sanitizeGlbOutputFilename(value = "") {
  const raw = String(value || "").trim();
  const fallback = "NewHumanCharacter.glb";
  const withoutPath = raw.split(/[\\/]+/).filter(Boolean).pop() || fallback;
  const stem = withoutPath.replace(/\.[^.]*$/, "")
    .replace(/[^A-Za-z0-9_. -]+/g, "")
    .replace(/\s+/g, "")
    .replace(/^\.+/, "")
    .trim() || "NewHumanCharacter";
  return `${stem}.glb`;
}

function cleanNotebookGlbTargetPath(value) {
  const raw = String(value ?? "").replace(/\\/g, "/").trim().replace(/^\/+/, "");
  const withoutPrefix = raw.replace(/^Notebook\/?/i, "");
  if (!withoutPrefix) {
    const err = new Error("Target path is required.");
    err.status = 400;
    throw err;
  }
  const directory = path.posix.dirname(withoutPrefix);
  const base = path.posix.basename(withoutPrefix);
  const safeFilename = sanitizeGlbOutputFilename(base);
  return directory && directory !== "."
    ? `${cleanRelativePath(directory, "Target directory")}/${safeFilename}`
    : safeFilename;
}

export function resolveTemplateBinarySaveTarget(targetPath, ctx = BASE_CONTEXT) {
  const relativePath = cleanNotebookGlbTargetPath(targetPath);
  const absolute = path.resolve(ctx.notebookDir, relativePath);
  if (!isWithin(ctx.notebookDir, absolute)) {
    const err = new Error("Export path must stay inside the Notebook.");
    err.status = 403;
    throw err;
  }
  return { absolute, relativePath };
}

export async function saveTemplateBinaryFile(options = {}, ctx = BASE_CONTEXT) {
  const { targetPath, fileBuffer } = options;
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    const err = new Error("A binary .glb file upload is required.");
    err.status = 400;
    throw err;
  }
  const destination = resolveTemplateBinarySaveTarget(targetPath, ctx);
  const parent = path.dirname(destination.absolute);
  await assertNotebookAncestorIsSafe(ctx, parent);
  await fs.mkdir(parent, { recursive: true });
  await assertNotebookParentIsSafe(ctx, destination);
  await fs.writeFile(destination.absolute, fileBuffer, { flag: "wx" });
  return {
    success: true,
    path: destination.relativePath,
    bytes: fileBuffer.length,
    outputExtension: "glb",
  };
}


export async function saveNotebookFileAsTemplate(options = {}, ctx = BASE_CONTEXT) {
  const { sourcePath, filename, kind = "file" } = options;
  const source = resolveNotebookSource(ctx, sourcePath);

  let stat = null;
  try {
    stat = await fs.lstat(source.absolute);
  } catch (err) {
    if (err?.code === "ENOENT") {
      err.status = 404;
      err.message = "Source file not found.";
    }
    throw err;
  }

  if (!stat.isFile()) {
    const err = new Error("Source path must point to a file.");
    err.status = 400;
    throw err;
  }

  const templateRoot = getTemplateRoot(ctx);
  const templateFilename = cleanFilename(filename || path.posix.basename(source.relativePath));
  const shouldSaveAsForm = kind === "form" || isFormTemplateFilename(templateFilename) || isFormTemplateFilename(source.relativePath);
  const destinationRoot = shouldSaveAsForm ? getFormTemplateRoot(ctx) : getRawTemplateRoot(ctx);
  const absolute = path.resolve(destinationRoot, templateFilename);
  const destination = {
    absolute,
    relativePath: path.relative(templateRoot, absolute).split(path.sep).join("/"),
  };

  if (!isWithin(destinationRoot, destination.absolute)) {
    const err = new Error("Template destination is outside the selected templates folder.");
    err.status = 403;
    throw err;
  }

  await fs.mkdir(destinationRoot, { recursive: true });
  await fs.copyFile(source.absolute, destination.absolute, fsConstants.COPYFILE_EXCL);

  const template = await createMetadata(templateRoot, destination.absolute);
  return {
    success: true,
    sourcePath: source.relativePath,
    templatePath: destination.relativePath,
    template,
  };
}

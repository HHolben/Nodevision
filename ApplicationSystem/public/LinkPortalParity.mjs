// Nodevision/ApplicationSystem/public/LinkPortalParity.mjs
// This module coordinates optional parity between HTML hyperlinks and MetaWorld portals without making either feature depend on the other.

const PREFERENCES_KEY = "nodevision.userPreferences";
const PARITY_KEY = "linkPortalParity";

function normalizeNotebookPath(value = "") {
  const raw = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "")
    .replace(/\/+/g, "/");
  const parts = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function dirname(path = "") {
  const clean = normalizeNotebookPath(path);
  return clean.includes("/") ? clean.slice(0, clean.lastIndexOf("/")) : "";
}

function basename(path = "") {
  return normalizeNotebookPath(path).split("/").filter(Boolean).pop() || "world.html";
}

function escapeHtmlText(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value = "") {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function targetHref(sourcePath = "", targetPath = "") {
  const sourceDir = dirname(sourcePath).split("/").filter(Boolean);
  const target = normalizeNotebookPath(targetPath);
  const targetParts = target.split("/").filter(Boolean);
  let index = 0;
  while (index < sourceDir.length && index < targetParts.length && sourceDir[index] === targetParts[index]) index += 1;
  return encodeURI([...sourceDir.slice(index).map(() => ".."), ...targetParts.slice(index)].join("/") || basename(target));
}

function resolveHref(sourcePath = "", href = "") {
  const raw = String(href || "").trim();
  if (!raw || /^(https?:)?\/\//i.test(raw) || /^(data|mailto|javascript|file):/i.test(raw)) return "";
  const pathPart = raw.split(/[?#]/)[0];
  if (pathPart.startsWith("/")) return normalizeNotebookPath(pathPart);
  let candidate = pathPart.replace(/^\/+/, "");
  if (/^Notebook\//i.test(candidate)) return normalizeNotebookPath(candidate);
  const base = dirname(sourcePath);
  return normalizeNotebookPath(base ? `${base}/${candidate}` : candidate);
}

export function isLinkPortalParityEnabled() {
  const root = typeof window !== "undefined" ? window : globalThis;
  const runtime = root.NodevisionUserPreferences || root.NodevisionState?.userPreferences || {};
  if (runtime[PARITY_KEY] === true) return true;
  try {
    const stored = JSON.parse(root.localStorage?.getItem(PREFERENCES_KEY) || "{}");
    return stored?.[PARITY_KEY] === true;
  } catch (_) {
    return false;
  }
}

function scriptLooksLikeMetaWorld(text = "") {
  return /"worldType"\s*:\s*"NodevisionMetaWorld"/i.test(String(text || "")) || /NodevisionMetaWorld/i.test(String(text || ""));
}

function parseWorldScript(text = "") {
  try {
    const parsed = JSON.parse(String(text || "").trim());
    return parsed && typeof parsed === "object" && scriptLooksLikeMetaWorld(text) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function portalTargetMatches(rawTarget = "", targetPath = "", sourcePath = "") {
  return resolveHref(sourcePath, rawTarget) === normalizeNotebookPath(targetPath);
}

function worldHasPortalTo(world, sourcePath, targetPath) {
  const objects = Array.isArray(world?.objects) ? world.objects : [];
  return objects.some((object) => {
    if (!object || typeof object !== "object") return false;
    const type = String(object.type || object.nvType || object.kind || "").toLowerCase();
    if (type !== "portal" && object.isPortal !== true) return false;
    if (object.sameWorld === true) return false;
    return portalTargetMatches(object.targetWorld || object.portalTarget || object.target || object.href || "", targetPath, sourcePath);
  });
}

function makePortalObject(targetPath = "") {
  const suffix = Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000);
  const id = "portal-parity-" + suffix;
  return {
    id, tag: id, name: "Portal to " + basename(targetPath), type: "portal", shape: "torus",
    position: [0, 0.8, -2], size: [0.72, 0.075], color: "#55ccff",
    opacity: 0.72, emissive: "#55ccff", emissiveIntensity: 0.95,
    targetWorld: "/Notebook/" + normalizeNotebookPath(targetPath),
    portalDestinationMode: "world", destinationMode: "world", sameWorld: false,
    spawnPoint: "default", cooldownMs: 1200, isSolid: false, breakable: false,
    paritySource: "hyperlink",
  };
}

function addPortalToWorldScript(scriptText, sourcePath, targetPath) {
  const world = parseWorldScript(scriptText);
  if (!world || worldHasPortalTo(world, sourcePath, targetPath)) return { changed: false, text: scriptText };
  world.objects = Array.isArray(world.objects) ? world.objects : [];
  world.objects.push(makePortalObject(targetPath));
  return { changed: true, text: JSON.stringify(world, null, 2) };
}

function updateActiveEditorWorldScript(sourcePath, targetPath) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (normalizeNotebookPath(window.__nvHtmlEditorActivePath || window.__nvWysiwygActivePath || "") !== normalizeNotebookPath(sourcePath)) return false;
  const hidden = document.getElementById("hidden-elements");
  if (!hidden) return false;
  for (const holder of Array.from(hidden.children)) {
    const result = addPortalToWorldScript(holder.dataset.script || "", sourcePath, targetPath);
    if (!result.changed) continue;
    holder.dataset.script = result.text;
    window.HTMLWysiwygTools?.markDirty?.();
    return true;
  }
  return false;
}

async function fetchNotebookText(path) {
  const sourcePath = normalizeNotebookPath(path);
  const res = await fetch(`/api/fileCodeContent?path=${encodeURIComponent(sourcePath)}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || "Could not read " + sourcePath);
  return String(data.content ?? "");
}

async function saveNotebookText(path, content) {
  const sourcePath = normalizeNotebookPath(path);
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: sourcePath, sourcePath, content }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) throw new Error(data?.error || "Could not save " + sourcePath);
}

function replaceWorldScriptInHtml(html, updater) {
  let changed = false;
  const output = String(html || "").replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, body) => {
    if (!scriptLooksLikeMetaWorld(attrs + "\n" + body)) return match;
    const result = updater(body);
    if (!result?.changed) return match;
    changed = true;
    return `<script${attrs}>${result.text}</script>`;
  });
  return { changed, html: output };
}

function htmlHasLinkTo(html, sourcePath, targetPath) {
  const regex = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi;
  let match;
  while ((match = regex.exec(String(html || "")))) {
    if (resolveHref(sourcePath, match[2]) === normalizeNotebookPath(targetPath)) return true;
  }
  return false;
}

function addHyperlinkToHtml(html, sourcePath, targetPath, label = "") {
  if (htmlHasLinkTo(html, sourcePath, targetPath)) return { changed: false, html };
  const href = targetHref(sourcePath, targetPath);
  const text = label || "Open " + basename(targetPath);
  const link = `<p data-nodevision-portal-parity-link="${escapeHtmlAttribute(normalizeNotebookPath(targetPath))}"><a href="${escapeHtmlAttribute(href)}">${escapeHtmlText(text)}</a></p>`;
  if (/<\/body>/i.test(html)) return { changed: true, html: html.replace(/<\/body>/i, `${link}\n</body>`) };
  return { changed: true, html: String(html || "") + "\n" + link + "\n" };
}

export async function syncPortalForHyperlink({ sourcePath, targetPath } = {}) {
  if (!isLinkPortalParityEnabled()) return { changed: false, reason: "disabled" };
  const source = normalizeNotebookPath(sourcePath);
  const target = normalizeNotebookPath(targetPath);
  if (!source || !target || source === target || !/\.(html?|xhtml|php)$/i.test(target)) return { changed: false, reason: "not-world-link" };
  if (updateActiveEditorWorldScript(source, target)) return { changed: true, target: "active-editor" };
  const html = await fetchNotebookText(source);
  const result = replaceWorldScriptInHtml(html, (body) => addPortalToWorldScript(body, source, target));
  if (!result.changed) return { changed: false, reason: "no-metaworld-or-existing" };
  await saveNotebookText(source, result.html);
  return { changed: true, target: "file" };
}

export async function syncHyperlinkForPortal({ sourcePath, targetPath, label = "" } = {}) {
  if (!isLinkPortalParityEnabled()) return { changed: false, reason: "disabled" };
  const source = normalizeNotebookPath(sourcePath);
  const rawTarget = String(targetPath || "").trim();
  if (/^(https?:)?\/\//i.test(rawTarget) || /^(data|mailto|javascript|file):/i.test(rawTarget)) return { changed: false, reason: "external-target" };
  const target = resolveHref(source, rawTarget) || normalizeNotebookPath(rawTarget);
  if (!source || !target || source === target) return { changed: false, reason: "missing-path" };
  const html = await fetchNotebookText(source);
  const result = addHyperlinkToHtml(html, source, target, label);
  if (!result.changed) return { changed: false, reason: "existing-link" };
  await saveNotebookText(source, result.html);
  return { changed: true, target: "file" };
}

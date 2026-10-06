// Nodevision/ApplicationSystem/public/MetaWorld/WorldDocumentDrafts.mjs
// This module retains unsaved declarative world definitions with their HTML source baseline so temporary views can share drafts without owning scene state.

import { getLiveFileContentForPath, normalizeLiveFilePath } from "../LiveFileContent.mjs";
const drafts = new Map();
function worldMarkup(html) {
  return (String(html).match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [])
    .filter(script => /data-nodevision-meta-world|nodevision-metaworld|application\/json/i.test(script.slice(0, script.indexOf(">"))))
    .join("\n");
}
export async function readWorldHtml(path) {
  const live = getLiveFileContentForPath(path);
  if (live && typeof live.content === "string") return live.content;
  const response = await fetch("/Notebook/" + normalizeLiveFilePath(path).split("/").map(encodeURIComponent).join("/"), { cache: "no-store" });
  if (!response.ok) throw new Error(`Cannot read world page (${response.status}).`);
  return response.text();
}
export function stageWorldDraft(path, definition, sourceHtml) {
  drafts.set(normalizeLiveFilePath(path), { definition: structuredClone(definition), sourceHtml });
}
export function readWorldDraft(path, sourceHtml) {
  const key = normalizeLiveFilePath(path), draft = drafts.get(key);
  if (!draft) return null;
  if (draft.sourceHtml !== sourceHtml && worldMarkup(draft.sourceHtml) !== worldMarkup(sourceHtml)) { drafts.delete(key); return null; }
  draft.sourceHtml = sourceHtml;
  return structuredClone(draft.definition);
}
export function clearWorldDraft(path) { drafts.delete(normalizeLiveFilePath(path)); }
export function readEmbeddedWorld(html, Parser = DOMParser) {
  const doc = new Parser().parseFromString(html, "text/html");
  // Recognize the same legacy candidates as the existing server loader; ambiguous JSON is never replaced.
  const script = doc.querySelector('script[data-nodevision-meta-world], script#nodevision-metaworld, script[type="application/json"]');
  if (!script) return null;
  try {
    const json = script.textContent.replace(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
      token => token.startsWith('"') ? token : "");
    const definition = JSON.parse(json);
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) throw new Error("Invalid world");
    return definition;
  }
  catch { throw new Error("The page has an unreadable world definition. Automatic Sandbox creation was skipped."); }
}

// Nodevision/ApplicationSystem/public/Sessions/SandboxWorldStartup.mjs
// This adapter performs Sandbox planning once per world load and preserves unsaved definitions through the ordinary world serializer and document draft service.

import { getLiveFileContentForPath, normalizeLiveFilePath } from "../LiveFileContent.mjs";
import { readWorldHtml, readEmbeddedWorld, readWorldDraft, stageWorldDraft } from "../MetaWorld/WorldDocumentDrafts.mjs";
import { planSandboxWorld } from "../MetaWorld/SandboxWorldPlanner.mjs";
import { buildWorldDefinition } from "../PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs";
export function createSandboxWorldStartup({ readHtml = readWorldHtml, parse = readEmbeddedWorld,
  getRuntime = () => window.VRWorldContext, status = () => {} } = {}) {
  const sources = new Map();
  function capture(runtime = getRuntime()) {
    const path = normalizeLiveFilePath(runtime?.currentWorldPath || "");
    if (!runtime?.currentWorldDefinition || runtime.worldLoadComplete === false || !sources.has(path)) return;
    stageWorldDraft(path, buildWorldDefinition({ existingWorldDefinition: runtime.currentWorldDefinition,
      objects: runtime.objects, lights: runtime.lights, movementState: runtime.movementState }), sources.get(path));
  }
  async function resolve(path) {
    path = normalizeLiveFilePath(path);
    if (!/\.html?$/i.test(path)) throw new Error("Sandbox requires an HTML page. Select an HTML file and start the Session again.");
    capture();
    const html = await readHtml(path);
    const saved = parse(html);
    const active = getRuntime();
    if (!sources.has(path) && normalizeLiveFilePath(active?.currentWorldPath || "") === path && active?.currentWorldDefinition) {
      sources.set(path, html);
      capture(active); // Preserve even unsaved edits in an already-open ordinary Game View.
    }
    const draft = readWorldDraft(path, html);
    sources.set(path, html);
    const planned = planSandboxWorld(draft || saved, path);
    if (planned.created) stageWorldDraft(path, planned.definition, html);
    status(planned.kind === "authored" ? "Sandbox: authored world preserved; automatic terrain creation skipped."
      : planned.created ? "Sandbox terrain created. Save in Build to keep it after reloading Nodevision. Nearby chunks are loading."
      : "Sandbox: reusing the existing world. Nearby chunks are loading.");
    return planned.definition;
  }
  function saved(path, html) { sources.set(normalizeLiveFilePath(path), getLiveFileContentForPath(path)?.content ?? html); }
  return { resolve, capture, saved };
}

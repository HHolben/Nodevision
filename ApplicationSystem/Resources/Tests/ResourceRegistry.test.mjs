// Nodevision/ApplicationSystem/Resources/Tests/ResourceRegistry.test.mjs
// Verifies typed resource source resolution, overlays, dictionary operations, and path safety.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveDictionaryLayers } from "../DictionaryResourceResolver.mjs";
import { getResources } from "../ResourceRegistry.mjs";
import { saveResourceTypeSources } from "../ResourceSettingsStore.mjs";

async function makeContext(prefix = "nodevision-resources-") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const ctx = {
    runtimeRoot: root,
    applicationSystemRoot: path.join(root, "ApplicationSystem"),
    publicDir: path.join(root, "ApplicationSystem", "public"),
    notebookDir: path.join(root, "Notebook"),
    userSettingsDir: path.join(root, "UserSettings"),
    userDataDir: path.join(root, "UserData"),
  };
  await fs.mkdir(ctx.publicDir, { recursive: true });
  await fs.mkdir(ctx.notebookDir, { recursive: true });
  await fs.mkdir(ctx.userSettingsDir, { recursive: true });
  await fs.mkdir(ctx.userDataDir, { recursive: true });
  return ctx;
}

async function writeFile(filePath, contents = "x") {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
}

async function testCollectionSourcesAndMissingDirectories() {
  const ctx = await makeContext();
  await writeFile(path.join(ctx.publicDir, "fonts", "AppFace.woff2"));
  await writeFile(path.join(ctx.userDataDir, "Resources", "Fonts", "ManagedFace.otf"));
  await writeFile(path.join(ctx.notebookDir, "Library", "Fonts", "LibraryFace.ttf"));

  await saveResourceTypeSources(ctx, "font", [
    { id: "font.application", sourceType: "application", name: "Application Fonts", path: "fonts", enabled: true, priority: 0, protected: true },
    { id: "font.managed", sourceType: "managed", name: "Managed Fonts", path: "Resources/Fonts", enabled: true, priority: 100, protected: true },
    { id: "font.notebook.default", sourceType: "notebook", name: "Library Fonts", path: "Library/Fonts", enabled: true, priority: 200, protected: true, legacyPath: true },
    { id: "font.notebook.missing", sourceType: "notebook", name: "Missing Fonts", path: "Missing/Fonts", enabled: true, priority: 300 },
  ]);

  const payload = await getResources(ctx, "font");
  assert.deepEqual(payload.resources.map((item) => item.family).sort(), ["AppFace", "LibraryFace", "ManagedFace"]);
  assert(payload.diagnostics.some((item) => item.code === "source-missing" && item.sourceId === "font.notebook.missing"));
}

async function testDisabledSourceAndDuplicates() {
  const ctx = await makeContext();
  await writeFile(path.join(ctx.publicDir, "fonts", "SharedFace.woff2"));
  await writeFile(path.join(ctx.notebookDir, "Resources", "Fonts", "SharedFace.ttf"));
  await writeFile(path.join(ctx.notebookDir, "Personal", "Fonts", "PersonalOnly.ttf"));

  await saveResourceTypeSources(ctx, "font", [
    { id: "font.application", sourceType: "application", name: "Application Fonts", path: "fonts", enabled: true, priority: 0, protected: true },
    { id: "font.managed", sourceType: "managed", name: "Managed Fonts", path: "Resources/Fonts", enabled: false, priority: 100, protected: true },
    { id: "font.notebook.default", sourceType: "notebook", name: "Notebook Fonts", path: "Resources/Fonts", enabled: true, priority: 200, protected: true, legacyPath: true },
    { id: "font.notebook.personal", sourceType: "notebook", name: "Personal Fonts", path: "Personal/Fonts", enabled: false, priority: 300 },
  ]);

  const payload = await getResources(ctx, "font");
  assert.equal(payload.resources.filter((item) => item.family === "SharedFace").length, 1);
  assert.equal(payload.resources.find((item) => item.family === "SharedFace").sourceId, "font.notebook.default");
  assert(!payload.resources.some((item) => item.family === "PersonalOnly"));
}

async function testMaterialOverlay() {
  const ctx = await makeContext();
  await writeFile(path.join(ctx.publicDir, "MetaWorld", "Materials", "Solids", "Stone.json"), JSON.stringify({ id: "Stone", displayName: "Stone", rendering: { color: "#777777" }, collider: { friction: 0.4 } }));
  await writeFile(path.join(ctx.userDataDir, "Resources", "Materials", "Stone.json"), JSON.stringify({ id: "Stone", displayName: "Workshop Stone", collider: { restitution: 0.1 } }));
  await writeFile(path.join(ctx.notebookDir, "Resources", "Materials", "Stone.json"), JSON.stringify({ id: "Stone", rendering: { color: "#999999" } }));
  await writeFile(path.join(ctx.notebookDir, "Resources", "Materials", "Foam.json"), JSON.stringify({ id: "Foam", displayName: "Foam", collider: { restitution: 0.9 } }));

  await saveResourceTypeSources(ctx, "material", [
    { id: "material.application", sourceType: "application", name: "Application Materials", path: "MetaWorld/Materials", enabled: true, priority: 0, protected: true },
    { id: "material.managed", sourceType: "managed", name: "Managed Materials", path: "Resources/Materials", enabled: true, priority: 100, protected: true },
    { id: "material.notebook.default", sourceType: "notebook", name: "Notebook Materials", path: "Resources/Materials", enabled: true, priority: 200, protected: true, legacyPath: true },
  ]);

  const payload = await getResources(ctx, "material");
  const stone = payload.resources.find((item) => item.materialId === "Stone");
  assert.equal(stone.displayName, "Workshop Stone");
  assert.equal(stone.data.rendering.color, "#999999");
  assert.equal(stone.data.collider.friction, 0.4);
  assert.equal(stone.data.collider.restitution, 0.1);
  assert.equal(stone.layers.length, 3);
  assert(payload.resources.some((item) => item.materialId === "Foam"));
}

function testDictionaryOperations() {
  const base = { id: "dictionary.application", name: "Application Dictionary", priority: 0 };
  const personal = { id: "dictionary.notebook.personal", name: "Personal Dictionary", priority: 200 };
  const entries = resolveDictionaryLayers([
    { source: base, entries: [
      { term: "lift", spelling: { accepted: true }, senses: [{ senseId: "flight", definition: "Upward aerodynamic force.", partOfSpeech: "noun" }, { senseId: "raise", definition: "To raise." }] },
      { term: "drag", senses: [{ senseId: "flight", definition: "Aerodynamic resistance." }] },
    ] },
    { source: personal, entries: [
      { operation: "override-sense", term: "lift", senseId: "flight", definition: "Force perpendicular to the relative wind." },
      { operation: "annotate", term: "lift", senseId: "flight", note: "Used by the aviation lessons." },
      { operation: "suppress", term: "drag" },
      { operation: "add", term: "sectional", spelling: { accepted: true, tags: ["aviation"] }, senses: [{ senseId: "chart", definition: "An FAA aeronautical chart." }] },
    ] },
  ]);

  const lift = entries.find((entry) => entry.term === "lift");
  assert.equal(lift.senses.find((sense) => sense.senseId === "flight").definition, "Force perpendicular to the relative wind.");
  assert.equal(lift.senses.find((sense) => sense.senseId === "raise").definition, "To raise.");
  assert.equal(lift.senses.find((sense) => sense.senseId === "flight").annotations.length, 1);
  assert(!entries.some((entry) => entry.term === "drag"));
  assert.equal(entries.find((entry) => entry.term === "sectional").spelling.tags[0], "aviation");
}

async function testPathTraversalRejected() {
  const ctx = await makeContext();
  await assert.rejects(
    () => saveResourceTypeSources(ctx, "font", [
      { id: "font.application", sourceType: "application", name: "Application Fonts", path: "fonts", enabled: true, priority: 0, protected: true },
      { id: "font.managed", sourceType: "managed", name: "Managed Fonts", path: "Resources/Fonts", enabled: true, priority: 100, protected: true },
      { id: "font.notebook.default", sourceType: "notebook", name: "Notebook Fonts", path: "../escape", enabled: true, priority: 200, protected: true, legacyPath: true },
    ]),
    /traversal|outside/i,
  );
}

await testCollectionSourcesAndMissingDirectories();
await testDisabledSourceAndDuplicates();
await testMaterialOverlay();
testDictionaryOperations();
await testPathTraversalRejected();
console.log("Resource Registry tests passed.");

// Nodevision/ApplicationSystem/ResourcePaths/Tests/ResourcePaths.test.mjs
// This test file verifies Resource Paths settings, validation, custom entries, portability, and sectional-map integration.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getResourcePath,
  getResourcePathsSettingsPath,
  hasResourcePath,
  listResourcePaths,
  removeResourcePath,
  resolveResourcePath,
  saveResourcePathEntries,
  setResourcePath,
} from "../ResourcePathStore.mjs";
import { normalizeResourceKey, normalizeResourceRelativePath } from "../ResourcePathValidation.mjs";
import {
  getSectionalMapsDirectory,
  loadSectionalMapSettings,
  saveSectionalMapSettings,
} from "../../Aviation/SectionalMaps/SectionalMapSettings.mjs";

async function makeContext(prefix = "nodevision-resource-paths-") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const ctx = {
    runtimeRoot: root,
    notebookDir: path.join(root, "Notebook"),
    userSettingsDir: path.join(root, "UserSettings"),
  };
  await fs.mkdir(ctx.notebookDir, { recursive: true });
  await fs.mkdir(ctx.userSettingsDir, { recursive: true });
  return ctx;
}

async function testBuiltInsAndMissingStatus() {
  const ctx = await makeContext();
  const entries = await listResourcePaths(ctx);
  assert(entries.some((entry) => entry.key === "aviation.sectionalMaps"));
  assert(entries.some((entry) => entry.key === "maps.streetMaps"));
  const sectionals = await getResourcePath(ctx, "aviation.sectionalMaps");
  assert.equal(sectionals.name, "FAA Sectional Maps");
  assert.equal(sectionals.path, "Resources/Aviation/Sectionals");
  assert.equal(sectionals.exists, false);
  assert.equal(await hasResourcePath(ctx, "fonts"), true);
}

async function testValidationAndCustomCrud() {
  const ctx = await makeContext();
  assert.equal(normalizeResourceKey("project.media"), "project.media");
  assert.throws(() => normalizeResourceKey("Project Media"), /machine-readable/i);
  assert.throws(() => normalizeResourceRelativePath("../../outside"), /traversal/i);
  assert.throws(() => normalizeResourceRelativePath("/tmp/outside"), /Notebook-relative/i);

  await setResourcePath(ctx, { key: "project.media", name: "Project Media", path: "Library/Media" });
  let custom = await getResourcePath(ctx, "project.media");
  assert.equal(custom.path, "Library/Media");
  assert.equal(custom.exists, false);

  await setResourcePath(ctx, { key: "project.media", name: "Project Media", path: "Library/SharedMedia" });
  custom = await getResourcePath(ctx, "project.media");
  assert.equal(custom.path, "Library/SharedMedia");
  await removeResourcePath(ctx, "project.media");
  await assert.rejects(() => getResourcePath(ctx, "project.media"), /not configured/i);
  await assert.rejects(() => removeResourcePath(ctx, "fonts"), /Built-in/i);
}

async function testSavePayloadAndDuplicatePrevention() {
  const ctx = await makeContext();
  await assert.rejects(
    () => saveResourcePathEntries(ctx, [
      { key: "custom.one", name: "One", path: "Resources/One" },
      { key: "custom.one", name: "Two", path: "Resources/Two" },
    ]),
    /duplicate/i,
  );
  await saveResourcePathEntries(ctx, [{ key: "custom.one", name: "One", path: "Resources/One" }]);
  const entries = await listResourcePaths(ctx);
  assert(entries.find((entry) => entry.key === "custom.one"));
  assert(entries.find((entry) => entry.key === "fonts"), "built-ins remain after collection save");
}

async function testResolveAndPortability() {
  const first = await makeContext();
  await fs.mkdir(path.join(first.notebookDir, "Resources", "Fonts"), { recursive: true });
  const resolved = await resolveResourcePath(first, "fonts");
  assert.equal(resolved.absoluteDirectory, path.join(first.notebookDir, "Resources", "Fonts"));
  assert.equal(resolved.exists, true);

  const raw = await fs.readFile(getResourcePathsSettingsPath(first), "utf8").catch(() => "");
  assert(!raw.includes(first.notebookDir), "settings must not persist absolute notebook paths");

  const second = await makeContext();
  await fs.mkdir(path.dirname(getResourcePathsSettingsPath(second)), { recursive: true });
  await fs.writeFile(getResourcePathsSettingsPath(second), JSON.stringify({
    version: 1,
    resourcePaths: { fonts: { path: "Resources/Fonts" } },
  }));
  const secondResolved = await resolveResourcePath(second, "fonts");
  assert.equal(secondResolved.absoluteDirectory, path.join(second.notebookDir, "Resources", "Fonts"));
}

async function testMalformedSettingsAndSectionals() {
  const ctx = await makeContext();
  await fs.writeFile(getResourcePathsSettingsPath(ctx), "{broken json");
  const fallback = await getResourcePath(ctx, "fonts");
  assert.equal(fallback.path, "Resources/Fonts");

  await saveSectionalMapSettings(ctx, { sectionalMapsDirectory: "Library/Sectionals" });
  const sectionals = await loadSectionalMapSettings(ctx);
  assert.equal(sectionals.sectionalMapsDirectory, "Library/Sectionals");
  const resolved = await getSectionalMapsDirectory(ctx);
  assert.equal(resolved.absoluteDirectory, path.join(ctx.notebookDir, "Library", "Sectionals"));

  await fs.writeFile(getResourcePathsSettingsPath(ctx), JSON.stringify({
    version: 1,
    resourcePaths: { "aviation.sectionalMaps": { path: "../../outside" } },
  }));
  await assert.rejects(() => loadSectionalMapSettings(ctx), /traversal/i);
}

await testBuiltInsAndMissingStatus();
await testValidationAndCustomCrud();
await testSavePayloadAndDuplicatePrevention();
await testResolveAndPortability();
await testMalformedSettingsAndSectionals();
console.log("Resource Paths tests passed.");

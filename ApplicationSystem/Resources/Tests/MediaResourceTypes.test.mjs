// Nodevision/ApplicationSystem/Resources/Tests/MediaResourceTypes.test.mjs
// Verifies generic media resource types are registered for shared acquisition.

import assert from "node:assert/strict";
import { getResourceTypeDefinition, RESOURCE_TYPE_IDS } from "../ResourceTypeDefinitions.mjs";

const cases = [
  [RESOURCE_TYPE_IDS.IMAGE, ".png", "Resources/Media/Images"],
  [RESOURCE_TYPE_IDS.AUDIO, ".wav", "Resources/Media/Audio"],
  [RESOURCE_TYPE_IDS.VIDEO, ".mp4", "Resources/Media/Video"],
  [RESOURCE_TYPE_IDS.MODEL, ".stl", "Resources/Models"],
];

for (const [typeId, extension, notebookPath] of cases) {
  const type = getResourceTypeDefinition(typeId);
  assert.equal(type.id, typeId);
  assert(type.supportedExtensions.includes(extension), `${typeId} should support ${extension}`);
  assert(type.defaultSources.some((source) => source.sourceType === "notebook" && source.path === notebookPath), `${typeId} should include ${notebookPath}`);
  assert(type.defaultSources.some((source) => source.sourceType === "managed"), `${typeId} should include a managed source`);
}

console.log("ok - media resource type definitions are registered");

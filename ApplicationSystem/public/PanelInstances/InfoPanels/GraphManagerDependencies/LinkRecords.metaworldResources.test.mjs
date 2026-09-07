// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.metaworldResources.test.mjs
// Verifies saved MetaWorld media references produce graph resource edges.

import assert from "node:assert/strict";
import { parseLinkRecordsFromText } from "./LinkRecords.mjs";

const world = {
  worldType: "NodevisionMetaWorld",
  objects: [
    { type: "object-file", objectFile: "Notebook/Resources/Models/ship.stl" },
    { type: "panel", imageFile: "Resources/Media/Images/panel.png" },
    { type: "sound-object", audioLinkedPath: "Resources/Media/Audio/chime.wav" },
  ],
};
const html = `<html><body><script type="application/json" data-nodevision-meta-world>${JSON.stringify(world)}</script></body></html>`;
const records = parseLinkRecordsFromText(html, "Notebook/Worlds/index.html");

assert(records.some((record) => record.linkKind === "model-resource" && record.targetPath === "Resources/Models/ship.stl"));
assert(records.some((record) => record.linkKind === "image-resource" && record.targetPath === "Worlds/Resources/Media/Images/panel.png"));
assert(records.some((record) => record.linkKind === "audio-resource" && record.targetPath === "Worlds/Resources/Media/Audio/chime.wav"));
assert(records.every((record) => record.sourceFormat === "metaworld"));

console.log("ok - MetaWorld saved resource references produce graph records");

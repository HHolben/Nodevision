// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapSerialization.test.mjs
// This test file verifies image-map parsing, serialization, validation, and round-trip preservation for hand-authored HTML.

import assert from "node:assert/strict";
import { getRelativeNotebookReference, resolveNotebookReference } from "../../../utils/notebookPath.mjs";
import { validateImageMapModel } from "./ImageMapModel.mjs";
import { parseImageMapHtml, serializeImageMap } from "./ImageMapSerialization.mjs";

const manualHtml = `<figure>
  <img src="../Images/Diagram.png" usemap="#lesson-map" alt="Diagram" data-keep="yes">
  <map name="lesson-map" data-map-kind="lesson">
    <area shape="rect" coords="10,20,110,120" href="../Pages/A.html#top" alt="A" title="Alpha" target="_blank" data-note="kept">
    <area shape="circle" coords="200,160,40" href="../Pages/B.html" alt="B">
    <area shape="poly" coords="20,20,80,30,70,90" href="../Pages/C.html" alt="C">
  </map>
</figure>`;

const model = parseImageMapHtml(manualHtml);
assert.equal(model.map.name, "lesson-map");
assert.equal(model.image.attrs["data-keep"], "yes");
assert.equal(model.map.attrs["data-map-kind"], "lesson");
assert.equal(model.areas.length, 3);
assert.deepEqual(model.areas[0].coords, [10, 20, 110, 120]);
assert.equal(model.areas[0].attrs["data-note"], "kept");
assert.equal(validateImageMapModel(model).ok, true);

const serialized = serializeImageMap(model);
assert.match(serialized, /<img /);
assert.match(serialized, /usemap="#lesson-map"/);
assert.match(serialized, /<area /);
assert.doesNotMatch(serialized, /data-nv-saved-src/);

const roundTrip = parseImageMapHtml(serialized);
assert.deepEqual(roundTrip.areas.map((area) => area.coords), model.areas.map((area) => area.coords));
assert.equal(roundTrip.areas[0].href, "../Pages/A.html#top");
assert.equal(roundTrip.areas[0].target, "_blank");

const invalid = { ...model, areas: [{ shape: "circle", coords: [10, 10, -4], href: "bad.html", alt: "" }] };
assert.equal(validateImageMapModel(invalid).ok, false);
assert.doesNotMatch(serializeImageMap(invalid), /bad\.html/);

const href = getRelativeNotebookReference({
  sourcePath: "Notes/Topic/Page.html",
  targetPath: "Images/Diagram.png",
});
assert.equal(href, "../../Images/Diagram.png");
assert.equal(resolveNotebookReference({ sourcePath: "Notes/Topic/Page.html", reference: href }), "Images/Diagram.png");

console.log("ok - image map parsing, serialization, and path roundtrip");

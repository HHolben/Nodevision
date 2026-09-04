// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.imageText.test.mjs
// Smoke tests for image-backed text link parsing and source editing.

import assert from "node:assert/strict";
import { applyLinkRecordEdit, parseLinkRecordsFromText } from "./LinkRecords.mjs";

const html = `<p><span class="nodevision-image-text" data-nodevision-image-text="true" data-nodevision-image-src="Media/Initial.png" style="--nodevision-image-text-src:url(&quot;Media/Initial.png&quot;);background-image:var(--nodevision-image-text-src);color:transparent;">A</span></p>`;

const records = parseLinkRecordsFromText(html, "Page.html");
const imageTextRecords = records.filter((record) => record.linkProperty === "data-nodevision-image-src");

assert.equal(imageTextRecords.length, 1);
assert.equal(imageTextRecords[0].linkKind, "text-image-source");
assert.equal(imageTextRecords[0].targetPath, "Media/Initial.png");
assert.equal(imageTextRecords[0].linkText, "references image located at:");

const result = applyLinkRecordEdit(html, imageTextRecords[0], {
  targetRaw: "Media/Replaced.png",
});

assert.equal(result.changed, true);
assert.match(result.content, /data-nodevision-image-src="Media\/Replaced\.png"/);
assert.match(result.content, /--nodevision-image-text-src:url\(&quot;Media\/Replaced\.png&quot;\);/);
assert.doesNotMatch(result.content, /Media\/Initial\.png/);

console.log("ok - image text link records parse and retarget");

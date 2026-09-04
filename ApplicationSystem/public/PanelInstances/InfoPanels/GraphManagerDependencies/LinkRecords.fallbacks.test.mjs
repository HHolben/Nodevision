// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.fallbacks.test.mjs
// Smoke tests for Graph Manager parsing and editing ordered fallback HTML references.

import assert from "node:assert/strict";
import { applyLinkRecordEdit, parseLinkRecordsFromText } from "./LinkRecords.mjs";

const html = '<p><a href="../Library/Local.html" data-nodevision-fallback-1="../Archive/Local.html" data-nodevision-fallback-2="https://example.test/local">Local copy</a></p>';
const records = parseLinkRecordsFromText(html, "Notes/Page.html");
const anchorRecords = records.filter((record) => record.linkProperty === "href" || record.linkProperty.startsWith("data-nodevision-fallback-"));

assert.equal(anchorRecords.length, 3);
assert.equal(anchorRecords[0].referenceRole, "primary");
assert.equal(anchorRecords[0].targetPath, "Library/Local.html");
assert.equal(anchorRecords[1].referenceRole, "fallback");
assert.equal(anchorRecords[1].fallbackPriority, 1);
assert.equal(anchorRecords[1].primaryTargetRaw, "../Library/Local.html");
assert.equal(anchorRecords[1].primaryLinkProperty, "href");
assert.equal(anchorRecords[1].targetPath, "Archive/Local.html");
assert.equal(anchorRecords[2].referenceRole, "fallback");
assert.equal(anchorRecords[2].fallbackPriority, 2);
assert.equal(anchorRecords[2].targetKind, "external");
assert.equal(anchorRecords[2].referenceGroupId, anchorRecords[0].referenceGroupId);

const result = applyLinkRecordEdit(html, anchorRecords[1], {
  targetRaw: "../Mirrors/Local.html?copy=1&safe=true",
});

assert.equal(result.changed, true);
assert.match(result.content, /data-nodevision-fallback-1="\.\.\/Mirrors\/Local\.html\?copy=1&amp;safe=true"/);
assert.match(result.content, /href="\.\.\/Library\/Local\.html"/);
assert.match(result.content, /data-nodevision-fallback-2="https:\/\/example\.test\/local"/);

console.log("ok - graph link records parse and retarget ordered fallbacks");

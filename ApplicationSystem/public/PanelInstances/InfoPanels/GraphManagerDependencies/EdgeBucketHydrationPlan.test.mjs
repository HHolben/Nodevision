// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/EdgeBucketHydrationPlan.test.mjs
// This test proves targeted graph edge-bucket hydration preserves incoming and outgoing edges without loading every bucket.

import assert from "node:assert/strict";
import { buildEdgeBucketHydrationPlan } from "./EdgeBucketHydrationPlan.mjs";

const visiblePaths = ["Alpha.md"];
const bucketData = new Map([
  ["/public/data/edges/A.json", [
    { source: "Beta.md", target: "Alpha.md", label: "Beta incoming" },
    { source: "Gamma.md", target: "Alpha.md", label: "Gamma incoming" },
  ]],
  ["/public/data/edges/by-source/A.json", [
    { source: "Alpha.md", target: "Zebra.md", label: "Z outgoing" },
    { source: "Alpha.md", target: "Yankee.md", label: "Y outgoing" },
  ]],
  ["/public/data/edges/B.json", [
    { source: "Noise.md", target: "Beta.md" },
  ]],
  ["/public/data/edges/Z.json", [
    { source: "Alpha.md", target: "Zebra.md", label: "target-only copy should not be needed" },
  ]],
]);

function hydrate(plan) {
  const hydratedEdges = [];
  for (const request of plan.requests) {
    hydratedEdges.push(...(bucketData.get(request.url) || []));
  }
  return hydratedEdges;
}

function edgeKey(edge) {
  return edge.source + "->" + edge.target;
}

let loaded = new Set();
let plan = buildEdgeBucketHydrationPlan(visiblePaths, { loaded });
assert.equal(plan.requested, 2);
assert.deepEqual(plan.requests.map((request) => request.url).sort(), [
  "/public/data/edges/A.json",
  "/public/data/edges/by-source/A.json",
]);
assert(!plan.requests.some((request) => request.url.includes("/B.json")));
assert(!plan.requests.some((request) => request.url.includes("/Z.json")));
assert(plan.requested < 64);

let edgeKeys = new Set(hydrate(plan).map(edgeKey));
assert(edgeKeys.has("Beta.md->Alpha.md"));
assert(edgeKeys.has("Gamma.md->Alpha.md"));
assert(edgeKeys.has("Alpha.md->Zebra.md"));
assert(edgeKeys.has("Alpha.md->Yankee.md"));

for (const request of plan.requests) loaded.add(request.cacheKey);
plan = buildEdgeBucketHydrationPlan(visiblePaths, { loaded });
assert.equal(plan.requested, 0);

loaded = new Set();
plan = buildEdgeBucketHydrationPlan(visiblePaths, { loaded });
edgeKeys = new Set(hydrate(plan).map(edgeKey));
assert.equal(plan.requested, 2);
assert(edgeKeys.has("Beta.md->Alpha.md"));
assert(edgeKeys.has("Alpha.md->Zebra.md"));

console.log("Edge bucket hydration plan tests passed.");

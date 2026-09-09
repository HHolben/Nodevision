// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDirectoryImages.test.mjs
// Regression coverage for File Manager directory-image metadata and fallback probing.

import assert from "node:assert/strict";
import {
  clearDirectoryImageCache,
  directoryImageMetadataIsDefinitive,
  findDirectoryImageUrl,
  resolveDirectoryImageUrl,
  shouldProbeDirectoryImageFallback,
} from "./FileManagerDirectoryImages.mjs";

const withImage = {
  isDirectory: true,
  path: "Projects/Site",
  directoryImageName: ".directory.svg",
  directoryImageUrl: "/Notebook/Projects/Site/.directory.svg",
};
assert.equal(directoryImageMetadataIsDefinitive(withImage), true);
assert.equal(resolveDirectoryImageUrl(withImage), "/Notebook/Projects/Site/.directory.svg");
assert.equal(shouldProbeDirectoryImageFallback(withImage), false);

const withoutImage = {
  isDirectory: true,
  path: "Projects/Empty",
  directoryImageName: null,
  directoryImageUrl: null,
};
clearDirectoryImageCache();
let fetchCount = 0;
const missing = await findDirectoryImageUrl(withoutImage, {
  fetchImpl: async () => {
    fetchCount += 1;
    return { ok: false };
  },
});
assert.equal(missing, "");
assert.equal(fetchCount, 0, "definitive negative server metadata should skip fallback HEAD probes");

const incomplete = {
  isDirectory: true,
  path: "Projects/OldResponse",
};
clearDirectoryImageCache();
const probed = [];
const found = await findDirectoryImageUrl(incomplete, {
  fetchImpl: async (url) => {
    probed.push(url);
    return { ok: url.endsWith("/directory.png") };
  },
});
assert.equal(found, "/Notebook/Projects/OldResponse/directory.png");
assert.ok(probed.length > 0, "incomplete metadata should preserve compatibility fallback probing");

console.log("ok - FileManager directory image fallback trusts definitive server metadata");

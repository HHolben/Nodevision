// Nodevision/ApplicationSystem/public/GraphManagement/DirectoryAppearanceMetadata.test.mjs
// This test verifies directory appearance metadata normalization, reset behavior, legacy compatibility, and path remapping.

import assert from "node:assert/strict";
import { normalizeHexControlColor } from "../Controls/HexColorControl.mjs";
import {
  normalizeDirectoryMetadataPath,
  normalizeHexColor,
  normalizeAlpha,
  remapDirectoryAppearanceManifest,
  resolveDirectoryAppearanceFileManagerPalette,
  resolveDirectoryAppearanceGraphColors,
  sanitizeDirectoryAppearanceManifest,
  setDirectoryAppearanceInManifest,
} from "./DirectoryAppearanceMetadata.mjs";

assert.equal(normalizeDirectoryMetadataPath("/Notebook/Projects/Demo?x=1#section"), "Projects/Demo");
assert.equal(normalizeDirectoryMetadataPath("Projects//Demo/./Assets"), "Projects/Demo/Assets");
assert.equal(normalizeDirectoryMetadataPath("../outside"), "");

assert.equal(normalizeHexColor("#abc"), "#AABBCC");
assert.equal(normalizeHexColor("7a5c32"), "#7A5C32");
assert.equal(normalizeHexColor("rgb(1, 2, 3)"), "");
assert.equal(normalizeAlpha("50%"), 0.5);
assert.equal(normalizeAlpha(75), 0.75);
assert.equal(normalizeAlpha("1"), 1);
assert.equal(normalizeHexControlColor("#abc"), "#AABBCC");
assert.equal(normalizeHexControlColor("tomato"), "");

const legacy = sanitizeDirectoryAppearanceManifest({
  "Projects/Demo": { fillColor: "#abc", outlineColor: "7a5c32", fillAlpha: "50%", lineAlpha: 0.25 },
  "Projects/Invalid": { appearance: { fillColor: "tomato" } },
});
assert.deepEqual(legacy, {
  version: 1,
  directories: {
    "Projects/Demo": {
      appearance: {
        fillColor: "#AABBCC",
        outlineColor: "#7A5C32",
        fillAlpha: 0.5,
        outlineAlpha: 0.25,
      },
    },
  },
});

const updated = setDirectoryAppearanceInManifest({}, "Notebook/Projects/Demo", {
  fillColor: "#e8d7b5",
  outlineColor: "#7a5c32",
  fillAlpha: 0.7,
  outlineAlpha: "35%",
});
assert.deepEqual(updated.directories["Projects/Demo"].appearance, {
  fillColor: "#E8D7B5",
  outlineColor: "#7A5C32",
  fillAlpha: 0.7,
  outlineAlpha: 0.35,
});

const resetFill = setDirectoryAppearanceInManifest(updated, "Projects/Demo", {
  outlineColor: "#7A5C32",
  outlineAlpha: 0.35,
});
assert.deepEqual(resetFill.directories["Projects/Demo"].appearance, {
  outlineColor: "#7A5C32",
  outlineAlpha: 0.35,
});

const resetAll = setDirectoryAppearanceInManifest(updated, "Projects/Demo", {});
assert.deepEqual(resetAll.directories, {});

const remapped = remapDirectoryAppearanceManifest({
  directories: {
    "Projects/Demo": { appearance: { fillColor: "#E8D7B5" } },
    "Projects/Demo/Sub": { appearance: { outlineColor: "#7A5C32" } },
    "Projects/Other": { appearance: { fillColor: "#AABBCC" } },
  },
}, "Projects/Demo", "Archive/Demo");
assert.deepEqual(Object.keys(remapped.directories), [
  "Archive/Demo",
  "Archive/Demo/Sub",
  "Projects/Other",
]);

const basePalette = { backgroundColor: "white", borderColor: "gray", color: "black" };
const hoverPalette = { backgroundColor: "hover", borderColor: "hover-border", color: "black" };
const selectedPalette = { backgroundColor: "selected", borderColor: "selected-border", color: "white" };
assert.deepEqual(resolveDirectoryAppearanceFileManagerPalette({
  appearance: { fillColor: "#abc", outlineColor: "#123456", fillAlpha: 0.5, outlineAlpha: 0.25 },
  state: "base",
  base: basePalette,
  hover: hoverPalette,
  selected: selectedPalette,
}), { backgroundColor: "rgba(170, 187, 204, 0.5)", borderColor: "rgba(18, 52, 86, 0.25)", color: "black" });
assert.deepEqual(resolveDirectoryAppearanceFileManagerPalette({
  appearance: { fillColor: "#abc", outlineColor: "#123456" },
  state: "hover",
  base: basePalette,
  hover: hoverPalette,
  selected: selectedPalette,
}), hoverPalette);
assert.deepEqual(resolveDirectoryAppearanceGraphColors({
  appearance: { fillColor: "#E8D7B5", outlineColor: "#7A5C32", fillAlpha: 0.4, outlineAlpha: 0.75 },
  directoryColor: "depth-fill",
  directoryFillColor: "expanded-fill",
  directoryBorderColor: "depth-border",
  directoryExpandedBorderColor: "expanded-border",
}), {
  directoryColor: "#E8D7B5",
  directoryFillColor: "#E8D7B5",
  directoryBorderColor: "#7A5C32",
  directoryExpandedBorderColor: "#7A5C32",
  directoryFillOpacity: 0.4,
  directoryBorderOpacity: 0.75,
  directoryExpandedBorderOpacity: 0.75,
});

const clientFetchCalls = [];
globalThis.fetch = async (url) => {
  clientFetchCalls.push(String(url));
  const parsedUrl = new URL(String(url), "http://nodevision.test");
  const requested = JSON.parse(parsedUrl.searchParams.get("paths") || "[]");
  return {
    ok: true,
    async json() {
      return {
        paths: requested,
        directories: Object.fromEntries(requested.map((path) => [path, {
          appearance: path === "Projects" ? { fillColor: "#abc" } : {},
        }])),
      };
    },
  };
};
const directoryAppearanceClient = await import("./DirectoryAppearanceClient.mjs");
await directoryAppearanceClient.loadDirectoryAppearancesForPaths(["Projects", "Empty"]);
assert.equal(clientFetchCalls.length, 1);
assert.deepEqual(directoryAppearanceClient.getCachedDirectoryAppearance("Projects"), { fillColor: "#AABBCC" });
assert.deepEqual(directoryAppearanceClient.getCachedDirectoryAppearance("Empty"), {});
await directoryAppearanceClient.loadDirectoryAppearancesForPaths(["Projects", "Empty"]);
assert.equal(clientFetchCalls.length, 1);
await directoryAppearanceClient.loadDirectoryAppearancesForPaths(["Empty"], { force: true });
assert.equal(clientFetchCalls.length, 2);

console.log("Directory appearance metadata tests passed.");

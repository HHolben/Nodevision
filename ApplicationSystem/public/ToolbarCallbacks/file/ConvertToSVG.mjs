// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/ConvertToSVG.mjs
// This file defines the File menu callback that launches PNG-to-SVG vectorization from File > Export > Convert to SVG while leaving the source PNG unchanged.

import { openPngVectorizationOverlay, resolveActivePngPath } from "../../RasterVectorization/RasterVectorizationLauncher.mjs";

export default async function ConvertToSVG() {
  const sourcePath = resolveActivePngPath();
  if (!sourcePath) {
    alert("Open or select a PNG file before converting to SVG.");
    return;
  }
  try {
    await openPngVectorizationOverlay(sourcePath);
  } catch (error) {
    console.error("Convert to SVG failed:", error);
    alert("Convert to SVG failed: " + (error?.message || error));
  }
}

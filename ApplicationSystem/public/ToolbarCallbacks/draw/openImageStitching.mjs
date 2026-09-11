// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/openImageStitching.mjs
// Opens the landmark-based image stitcher against the active raster editor.

export default async function openImageStitching() {
  const editorApi = window.__nvRasterEditorApi || window.__nvPngEditorApi;
  if (!editorApi || typeof editorApi.replaceCanvasContents !== "function") {
    alert("Open a PNG or raster editor before using Image Stitching.");
    return;
  }
  const module = await import("/Sessions/LandmarkImageStitchingSession.mjs");
  return module.startLandmarkImageStitchingSession({ overlay: true, editorApi });
}

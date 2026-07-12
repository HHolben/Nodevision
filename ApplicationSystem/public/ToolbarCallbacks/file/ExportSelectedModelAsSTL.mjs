// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/ExportSelectedModelAsSTL.mjs
// Routes File -> Export -> STL to the active 3D editor/viewer.

export default async function ExportSelectedModelAsSTL() {
  const context = window.NodevisionModelExportContext;
  if (!context || typeof context.exportSTL !== "function") {
    alert("No STL-exportable 3D model is active.");
    return;
  }

  try {
    await context.exportSTL();
  } catch (err) {
    console.error("[Nodevision] STL export failed:", err);
    alert("STL export failed:\n" + (err?.message || err));
  }
}

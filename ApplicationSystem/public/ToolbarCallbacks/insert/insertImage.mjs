// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertImage.mjs
// This file defines browser-side insert Image logic for the Nodevision UI. It renders interface components and handles user interactions.
// Insert an image into the active graphical/text editor.
export default async function insertImage() {
  if (window.NodevisionState?.currentMode === "SVG Editing") {
    const [{ openInsertMediaPanel }, { renderImage }] = await Promise.all([
      import("/ToolbarJSONfiles/insertMediaPanel.mjs"),
      import("/ToolbarJSONfiles/insertMediaImage.mjs"),
    ]);
    const panel = await openInsertMediaPanel("Insert Image", "Image");
    renderImage(panel.mount, []);
    return;
  }

  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.insertImageAtCaret !== "function") {
    console.warn("insertImage: HTML image tools are unavailable.");
    return;
  }
  await tools.insertImageAtCaret();
}

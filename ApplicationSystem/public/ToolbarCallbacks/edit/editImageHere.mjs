// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/editImageHere.mjs
// This file defines browser-side edit Image Here logic for the Nodevision UI. It renders interface components and handles user interactions.
// Toggle in-document image editing at the selected image location.
export default async function editImageHere() {
  const tools = window.HTMLWysiwygTools;
  if (!tools) {
    console.warn("editImageHere: HTML image tools are unavailable.");
    return;
  }

  if (typeof tools.toggleSelectedImageInlineEditor === "function") {
    await tools.toggleSelectedImageInlineEditor();
    return;
  }

  if (typeof tools.openSelectedImageEditorUndocked === "function") {
    await tools.openSelectedImageEditorUndocked();
    return;
  }

  console.warn("editImageHere: no compatible image editor entry point is available.");
}

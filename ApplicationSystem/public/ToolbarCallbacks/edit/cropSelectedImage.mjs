// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/cropSelectedImage.mjs
// This file defines browser-side crop Selected Image logic for the Nodevision UI. It renders interface components and handles user interactions.
// Crop the currently selected image in the HTML/EPUB WYSIWYG editor.
export default async function cropSelectedImage() {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.cropSelectedImage !== "function") {
    console.warn("cropSelectedImage: HTML image tools are unavailable.");
    return;
  }
  await tools.cropSelectedImage();
}

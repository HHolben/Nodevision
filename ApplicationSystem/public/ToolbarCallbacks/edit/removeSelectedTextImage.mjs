// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/removeSelectedTextImage.mjs
// Remove image presentation from selected HTML image-backed text without deleting its text.

export default function removeSelectedTextImage() {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.removeSelectedTextImage !== "function") {
    console.warn("removeSelectedTextImage: HTML image-text tools are unavailable.");
    return false;
  }
  return tools.removeSelectedTextImage();
}

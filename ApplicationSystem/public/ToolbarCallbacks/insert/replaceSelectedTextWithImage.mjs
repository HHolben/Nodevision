// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/replaceSelectedTextWithImage.mjs
// Replace the active HTML editor text selection with an image-backed visual span.

export default async function replaceSelectedTextWithImage() {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.replaceSelectedTextWithImage !== "function") {
    console.warn("replaceSelectedTextWithImage: HTML image-text tools are unavailable.");
    return false;
  }
  return tools.replaceSelectedTextWithImage();
}

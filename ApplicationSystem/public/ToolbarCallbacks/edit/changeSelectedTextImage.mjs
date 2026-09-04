// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/changeSelectedTextImage.mjs
// Change the image used by the selected HTML image-backed text span.

export default async function changeSelectedTextImage() {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.changeSelectedTextImage !== "function") {
    console.warn("changeSelectedTextImage: HTML image-text tools are unavailable.");
    return false;
  }
  return tools.changeSelectedTextImage();
}

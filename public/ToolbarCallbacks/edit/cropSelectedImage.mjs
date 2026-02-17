// Crop the currently selected image in the HTML/EPUB WYSIWYG editor.
export default async function cropSelectedImage() {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.cropSelectedImage !== "function") {
    console.warn("cropSelectedImage: HTML image tools are unavailable.");
    return;
  }
  await tools.cropSelectedImage();
}

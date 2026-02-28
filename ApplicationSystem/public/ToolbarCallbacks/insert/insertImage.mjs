// Insert an image into the active HTML/EPUB WYSIWYG editor.
export default async function insertImage() {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.insertImageAtCaret !== "function") {
    console.warn("insertImage: HTML image tools are unavailable.");
    return;
  }
  await tools.insertImageAtCaret();
}

// Insert a PNG/SVG/image block into the active HTML layout canvas.
export default async function insertPositionableImage() {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.insertPositionableImage !== 'function') {
    console.warn('insertPositionableImage: HTML layout tools unavailable.');
    return;
  }
  await tools.insertPositionableImage();
}

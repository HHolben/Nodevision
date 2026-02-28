// Backward-compatible callback: now toggles the inline image editor.
export default async function openSelectedImageEditorUndocked() {
  const tools = window.HTMLWysiwygTools;
  if (!tools) {
    console.warn("openSelectedImageEditorUndocked: HTML image tools are unavailable.");
    return;
  }

  if (typeof tools.toggleSelectedImageInlineEditor === "function") {
    await tools.toggleSelectedImageInlineEditor();
    return;
  }

  if (typeof tools.openSelectedImageEditorUndocked !== "function") {
    console.warn("openSelectedImageEditorUndocked: HTML image tools are unavailable.");
    return;
  }

  await tools.openSelectedImageEditorUndocked();
}

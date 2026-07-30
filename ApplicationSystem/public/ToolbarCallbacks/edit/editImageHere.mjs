// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/editImageHere.mjs
// This file defines browser-side edit Image Here logic for the Nodevision UI. It renders interface components and handles user interactions.
// Toggle in-document image editing at the selected image location.
export default async function editImageHere() {
  const mode = window.NodevisionState?.currentMode;
  if (mode === "Virtual World Editing" || mode === "VR World Editing") {
    const worldTools = window.VRWorldContext;
    if (typeof worldTools?.editSelectedResourceHere === "function") {
      await worldTools.editSelectedResourceHere();
      return;
    }
    if (typeof worldTools?.embeddedResourceEditor?.openSelectedResource === "function") {
      await worldTools.embeddedResourceEditor.openSelectedResource();
      return;
    }
    console.warn("editImageHere: virtual world edit-here tools are unavailable.");
    return;
  }

  if (window.NodevisionState?.currentMode === "SVG Editing") {
    const svgTools = window.SVGEditorContext;
    if (typeof svgTools?.editSelectedImageHere === "function") {
      await svgTools.editSelectedImageHere();
      return;
    }
    if (typeof svgTools?.toggleSelectedImageInlineEditor === "function") {
      await svgTools.toggleSelectedImageInlineEditor();
      return;
    }
    console.warn("editImageHere: SVG image tools are unavailable.");
    return;
  }

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

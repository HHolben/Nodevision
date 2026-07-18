// Nodevision/ApplicationSystem/public/Layouts/ModeLayouts/GifEditorMode.mjs
// Default GIF editor mode layout: raster editor with a horizontal frame timeline.

export const GIF_EDITOR_MODE_LAYOUT = {
  id: "GifEditorMode",
  type: "column",
  children: [
    {
      type: "cell",
      id: "GraphicalEditor",
      role: "activeEditor",
      panelClass: "EditorPanel",
      flex: "1 1 78%",
    },
    {
      type: "cell",
      id: "GifTimelinePanel",
      panelType: "GifTimelinePanel",
      panelClass: "ControlPanel",
      displayName: "GIF Timeline",
      flex: "0 0 22%",
    },
  ],
};

export default GIF_EDITOR_MODE_LAYOUT;

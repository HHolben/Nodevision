// Nodevision/ApplicationSystem/Layouts/ModeLayouts/DefualtSVGEditorMode.mjs
// Default SVG editor mode layout: file manager, active SVG graphical editor, and a right-side inspector stack.

export const SVG_EDITOR_MODE_LAYOUT = {
  id: "SVGEditorMode",
  type: "row",
  children: [
    {
      type: "cell",
      id: "FileManager",
      panelType: "FileManager",
      panelClass: "InfoPanel",
      flex: "0 0 16%",
    },
    {
      type: "cell",
      id: "GraphicalEditor",
      role: "activeEditor",
      panelClass: "EditorPanel",
      flex: "1 1 68%",
    },
    {
      type: "column",
      id: "SVGInspectorRail",
      flex: "0 0 16%",
      children: [
        {
          type: "cell",
          id: "SVGLayersPanel",
          panelType: "SVGLayersPanel",
          panelClass: "InfoPanel",
          displayName: "SVG Layers",
          flex: "0 0 75%",
        },
        {
          type: "cell",
          id: "SVGPropertiesPanel",
          panelType: "SVGPropertiesPanel",
          panelClass: "InfoPanel",
          displayName: "SVG Element Properties",
          flex: "0 0 25%",
        },
      ],
    },
  ],
};

export default SVG_EDITOR_MODE_LAYOUT;

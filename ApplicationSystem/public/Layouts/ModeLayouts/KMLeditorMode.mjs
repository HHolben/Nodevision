// Nodevision/ApplicationSystem/public/Layouts/ModeLayouts/KMLeditorMode.mjs
// Default KML editor mode layout: file manager, active graphical KML editor, and shared right-side KML layers/properties panels.

export const KML_EDITOR_MODE_LAYOUT = {
  id: "KMLeditorMode",
  type: "row",
  children: [
    {
      type: "cell",
      id: "FileManager",
      panelType: "FileManager",
      panelClass: "InfoPanel",
      flex: "0 0 15%",
    },
    {
      type: "cell",
      id: "GraphicalEditor",
      role: "activeEditor",
      panelClass: "EditorPanel",
      flex: "1 1 65%",
    },
    {
      type: "column",
      id: "KMLEditorInspectorRail",
      flex: "0 0 20%",
      children: [
        {
          type: "cell",
          id: "KMLLayersPanel",
          panelType: "SVGLayersPanel",
          panelClass: "InfoPanel",
          displayName: "KML Layers",
          flex: "0 0 55%",
          panelVars: {
            preferredContext: "KML",
            title: "KML Layers",
          },
        },
        {
          type: "cell",
          id: "KMLPropertiesPanel",
          panelType: "SVGPropertiesPanel",
          panelClass: "InfoPanel",
          displayName: "KML Feature Properties",
          flex: "0 0 45%",
          panelVars: {
            preferredContext: "KML",
            title: "KML Feature Properties",
          },
        },
      ],
    },
  ],
};

export default KML_EDITOR_MODE_LAYOUT;

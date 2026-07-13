// Nodevision/ApplicationSystem/public/Layouts/ModeLayouts/KMLviewerMode.mjs
// Default KML viewer mode layout: file manager, active KML file viewer, and shared right-side KML layers/properties panels.

export const KML_VIEWER_MODE_LAYOUT = {
  id: "KMLviewerMode",
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
      id: "FileView",
      role: "activeEditor",
      panelClass: "ViewPanel",
      flex: "1 1 64%",
    },
    {
      type: "column",
      id: "KMLViewerInspectorRail",
      flex: "0 0 20%",
      children: [
        {
          type: "cell",
          id: "KMLLayersPanel",
          panelType: "SVGLayersPanel",
          panelClass: "InfoPanel",
          displayName: "KML Layers",
          flex: "0 0 32%",
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
          flex: "0 0 33%",
          panelVars: {
            preferredContext: "KML",
            title: "KML Feature Properties",
          },
        },
        {
          type: "cell",
          id: "KMLTerrainRegionPanel",
          panelType: "KMLTerrainRegionPanel",
          panelClass: "InfoPanel",
          displayName: "Terrain Region",
          flex: "0 0 35%",
        },
      ],
    },
  ],
};

export default KML_VIEWER_MODE_LAYOUT;

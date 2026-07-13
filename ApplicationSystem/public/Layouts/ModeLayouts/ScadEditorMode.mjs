// Nodevision/ApplicationSystem/public/Layouts/ModeLayouts/ScadEditorMode.mjs
// Default SCAD editor mode layout: graphical editor, shared layers panel, and timeline control panel.

export const SCAD_EDITOR_MODE_LAYOUT = {
  id: "ScadEditorMode",
  type: "column",
  children: [
    {
      type: "row",
      id: "ScadEditorMainRow",
      flex: "1 1 76%",
      children: [
        {
          type: "cell",
          id: "GraphicalEditor",
          role: "activeEditor",
          panelClass: "EditorPanel",
          flex: "1 1 76%",
        },
        {
          type: "cell",
          id: "SVGLayersPanel",
          panelType: "SVGLayersPanel",
          panelClass: "InfoPanel",
          displayName: "SCAD Layers",
          flex: "0 0 24%",
          forceReload: true,
          panelVars: {
            providerId: "scad",
            preferredContext: "scad",
          },
        },
      ],
    },
    {
      type: "cell",
      id: "CADTimelinePanel",
      panelType: "ScadTimelinePanel",
      panelClass: "ControlPanel",
      displayName: "CADtimeline",
      flex: "0 0 24%",
    },
  ],
};

export default SCAD_EDITOR_MODE_LAYOUT;

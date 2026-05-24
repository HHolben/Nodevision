// Nodevision/ApplicationSystem/public/Layouts/ModeLayouts/MidEditorMode.mjs
// This file defines the default MIDI editor mode layout with a virtual keyboard control panel.

export const MID_EDITOR_MODE_LAYOUT = {
  id: "MidEditorMode",
  type: "column",
  children: [
    {
      type: "row",
      id: "MidEditorMainRow",
      flex: "1 1 72%",
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
          flex: "1 1 84%",
        },
      ],
    },
    {
      type: "cell",
      id: "VirtualMidiKeyboard",
      panelType: "VirtualMidiKeyboard",
      panelClass: "ControlPanel",
      displayName: "Virtual MIDI Keyboard",
      flex: "0 0 28%",
      panelVars: {
        baseMidi: 60,
      },
    },
  ],
};

export default MID_EDITOR_MODE_LAYOUT;

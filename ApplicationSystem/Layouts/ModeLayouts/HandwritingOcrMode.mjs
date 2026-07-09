// Nodevision/ApplicationSystem/Layouts/ModeLayouts/HandwritingOcrMode.mjs
// Default layout for editors using the handwriting OCR control panel.

export const HANDWRITING_OCR_MODE_LAYOUT = {
  id: "HandwritingOcrMode",
  type: "column",
  children: [
    {
      type: "row",
      id: "HandwritingOcrMainRow",
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
      id: "HandwritingOcrPanel",
      panelType: "HandwritingOcrPanel",
      panelClass: "ControlPanel",
      displayName: "Handwriting OCR",
      flex: "0 0 28%",
    },
  ],
};

export default HANDWRITING_OCR_MODE_LAYOUT;

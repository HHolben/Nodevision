// Nodevision/ApplicationSystem/public/ToolbarCallbacks/settings/editLoginBackground.mjs
// Opens the Graphical SVG editor for the login background stored in ServerData.

export default function editLoginBackground() {
  const filePath = "/ServerData/NotebookLoginBackground.svg";

  // Ensure GraphicalEditor boots with the intended SVG.
  window.selectedFilePath = filePath;
  window.currentActiveFilePath = filePath;
  window.filePath = filePath;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.activeEditorFilePath = filePath;

  // Load the GraphicalEditor panel into the active cell.
  window.dispatchEvent(
    new CustomEvent("toolbarAction", {
      detail: {
        id: "GraphicalEditor",
        type: "EditorPanel",
        replaceActive: true,
      },
    }),
  );
}


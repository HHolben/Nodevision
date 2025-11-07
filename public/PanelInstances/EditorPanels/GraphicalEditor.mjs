// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditor.mjs
// This file replaces the content of the selected panel with the appropriate Nodevision graphical editor for the selected file's type

let lastEditedPath = null;

// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditor.mjs
export async function setupPanel(cell, instanceVars = {}) {
  const filePath = instanceVars.filePath || window.selectedFilePath || null;

  const container = document.createElement("div");
  container.id = "graphical-editor";
  container.style.flex = "1";
  container.style.display = "flex";
  container.style.justifyContent = "center";
  container.style.alignItems = "center";
  cell.appendChild(container);

  // If no file selected, show fallback right away
  if (!filePath) {
    const { renderEditor } = await import(
      "/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs"
    );
    renderEditor("(no file selected)", container);
    return;
  }

  console.log("🧭 Updating graphical editor for file:", filePath);

  // Determine which graphical editor to load (stub)
  let editorModulePath = null;
  const ext = filePath.split(".").pop().toLowerCase();

  if (["svg"].includes(ext)) {
    editorModulePath =
      "/PanelInstances/EditorPanels/GraphicalEditors/EditorSVG.mjs";
  } else if (["stl"].includes(ext)) {
    editorModulePath =
      "/PanelInstances/EditorPanels/GraphicalEditors/EditorSTL.mjs";
  } else {
    editorModulePath =
      "/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs";
  }

  try {
    const { renderEditor } = await import(editorModulePath);
    await renderEditor(filePath, container);
  } catch (err) {
    console.error("Failed to load graphical editor:", err);
  }
}


export async function updateGraphicalEditor(filePath) {
  const editorDiv = document.getElementById("graphical-editor");
  if (!editorDiv) {
    console.error("Graphical editor element not found.");
    return;
  }

  const filename = filePath || window.selectedFilePath;
  if (!filename) {
    editorDiv.innerHTML = "<em>No file selected.</em>";
    return;
  }

  if (filename === lastEditedPath) {
    console.log("🔁 File already loaded in editor:", filename);
    return;
  }
  lastEditedPath = filename;

  console.log("🧭 Updating graphical editor for file:", filename);
  editorDiv.innerHTML = "";

  const ext = filename.split(".").pop().toLowerCase();
  const basePath = "/PanelInstances/EditorPanels/GraphicalEditors";
  const editorModuleMap = {
    svg: "EditorSVG.mjs",
    stl: "EditorSTL.mjs",
    scad: "EditorSCAD.mjs",
    usd: "EditorUSD.mjs",
  };

  const editorModule = editorModuleMap[ext] || "EditorGeneric.mjs"; // Default fallback
  const modulePath = `${basePath}/${editorModule}`;
  console.log(`🔍 Loading editor module: ${modulePath}`);

  try {
    const editor = await import(modulePath);
    if (typeof editor.renderEditor === "function") {
      await editor.renderEditor(filename, editorDiv);
      console.log(`✅ Loaded graphical editor: ${editorModule}`);
    } else {
      editorDiv.innerHTML = `<em>${editorModule}</em> loaded, but no renderEditor() found.`;
      console.warn(`⚠️ No renderEditor() found in ${editorModule}`);
    }
  } catch (err) {
    console.error(`❌ Failed to import ${modulePath}:`, err);
    editorDiv.innerHTML = `<em>Error loading editor for ${filename}</em>`;
  }
}

// Expose globally
window.updateGraphicalEditor = updateGraphicalEditor;

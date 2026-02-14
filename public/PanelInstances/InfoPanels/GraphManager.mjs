// Nodevision/public/PanelInstances/InfoPanels/GraphManager.mjs
// Sets up the Graph Manager panel and loads GraphManagerCore.mjs
// Provides toolbar integration through panelCapabilities

import { updateToolbarState } from '/panels/createToolbar.mjs';

/**
 * Toolbar and System Integration
 */
export const panelCapabilities = {
  supportedActions: [
    'NewFile', 'NewDirectory', 'DeleteFile', 'renameFile',
    'copyFile', 'cutFile', 'pasteFile'
  ],
  panelType: 'GraphManager'
};

/**
 * Returns the global action handler (managed by GraphManagerCore)
 */
export function getActionHandler() {
  return window.handleGraphManagerAction;
}

/**
 * Main Setup Function
 */
export async function setupPanel(panelElem, panelVars = {}) {

  // Ensure the panel itself fills the cell
panelElem.style.height = "100%";
panelElem.style.display = "flex";
panelElem.style.flexDirection = "column";


  console.log("🛠️ Initializing GraphManager panel...", panelVars);

  // 1. Create the UI Structure
  panelElem.innerHTML = `
    <div class="graph-manager" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
      <div id="cy" style="flex-grow: 1; width: 100%; background: #ffffff; position: relative;"></div>
      
      <div id="graph-error" style="color:red; padding: 10px; font-weight: bold;"></div>
    </div>
  `;

  // 2. Focus & Toolbar State Management
  // This ensures that clicking the graph tells the system this is the active panel
  const handleFocus = () => {
    updateToolbarState({ activePanelType: 'GraphManager' });
    // This handler will be defined inside GraphManagerCore.mjs
    window.NodevisionState.activeActionHandler = window.handleGraphManagerAction;
  };

  panelElem.addEventListener('focus', handleFocus, true);
  panelElem.addEventListener('click', handleFocus);

  // 3. Dynamic Module Loading
  // We keep the heavy Cytoscape/Logic in 'Core' just like the File Manager
  try {
    const mod = await import("/PanelInstances/InfoPanels/GraphManagerCore.mjs");
    
    // Initialize the graph logic
    // We pass the root directory and the container ID
    await mod.initGraphView({
      containerId: 'cy',
      rootPath: panelVars.currentDirectory || '',      
      statusElemId: null
    });
    
    console.log("✅ GraphManagerCore loaded and initialized.");
  } catch (err) {
    console.error("❌ Failed to load GraphManagerCore.mjs:", err);
    const errElem = panelElem.querySelector("#graph-error");
    if (errElem) errElem.textContent = "Failed to initialize Graph Engine.";
  }
}

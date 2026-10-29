// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManager.mjs
// This module sets up the Graph Manager panel, loads GraphManagerCore.mjs, and provides toolbar integration through panelCapabilities.

import { registerPanelContentLifecycle } from '/panels/panelContentLifecycle.mjs';
import { createGraphManagerInstance } from "./GraphManagerCore.mjs";
import { activeGraphManager } from "./GraphManagerDependencies/GraphManagerInstances.mjs";
import { getNodevisionNavigationState } from '/NodevisionNavigationState.mjs';

const navigationState = getNodevisionNavigationState();

/**
 * Toolbar and System Integration
 */
export const panelCapabilities = {
  supportedActions: [
    'NewFile', 'NewDirectory', 'DeleteFile', 'renameFile',
    'copyFile', 'cutFile', 'pasteFile', 'setGraphAbstractionRootFromSelection'
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
  panelElem.style.minHeight = "0";
  panelElem.style.display = "flex";
  panelElem.style.flexDirection = "column";
  panelElem.style.width = "100%";
  panelElem.style.minWidth = "0";
  panelElem.style.boxSizing = "border-box";


  console.log("🛠️ Initializing GraphManager panel...", panelVars);

  // 1. Create the UI Structure
  panelElem.innerHTML = `
    <div class="graph-manager" style="width:100%;height:100%;min-width:0;min-height:0;display:flex;flex-direction:column;box-sizing:border-box;">
      <div class="graph-manager-surface" data-graph-manager-surface style="flex:1 1 auto;position:relative;min-width:0;min-height:0;width:100%;box-sizing:border-box;">
        <div data-graph-container style="width:100%;height:100%;min-width:0;min-height:0;background:#ffffff;position:relative;box-sizing:border-box;"></div>
        <div data-graph-mqtt-inspector style="display:none;position:absolute;right:10px;top:10px;z-index:5;width:min(310px,35%);max-height:70%;overflow:auto;background:rgba(255,255,255,0.96);border:1px solid #d8dde6;border-radius:8px;padding:10px;font-size:12px;box-shadow:0 8px 22px rgba(15,23,42,0.14);"></div>
        <div data-graph-link-inspector style="display:none;position:absolute;right:10px;bottom:10px;z-index:6;width:min(420px,48%);max-width:calc(100% - 20px);background:rgba(255,255,255,0.96);border:1px solid #cbd5e1;border-radius:8px;padding:10px;font:12px system-ui,sans-serif;box-shadow:0 8px 22px rgba(15,23,42,0.14);"></div>
      </div>

      <div data-graph-error style="flex:0 0 auto;color:red; padding: 10px; font-weight: bold;"></div>
    </div>
  `;

  const instance = createGraphManagerInstance({
    root: panelElem,
    container: panelElem.querySelector('[data-graph-container]'),
    linkInspector: panelElem.querySelector('[data-graph-link-inspector]'),
    mqttInspector: panelElem.querySelector('[data-graph-mqtt-inspector]'),
  });
  panelElem.dataset.graphInstanceId = instance.id;

  const handleFocus = () => {
    if (instance.destroyed || panelElem.closest('[hidden], [aria-hidden="true"]')) return;
    // Workspace normally publishes the cell first. Directly mounted panels also have an owner.
    window.activeCell = panelElem.closest('.panel-cell') || panelElem;
    instance.activate();
    if (activeGraphManager() !== instance) return;
    navigationState.setLastInfoPanelType("GraphManager");
    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: { heading: "Graph Manager", force: false, toggle: false }
    }));
  };
  panelElem.addEventListener('focus', handleFocus, true);
  panelElem.addEventListener('pointerdown', handleFocus, true);
  panelElem.addEventListener('click', handleFocus);
  let destroyed = false;
  const lifecycle = {
    get graph() { return instance.graph; },
    get instance() { return instance; },
    activate: () => instance.activate(),
    deactivate: () => instance.deactivate(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      panelElem.removeEventListener('focus', handleFocus, true);
      panelElem.removeEventListener('pointerdown', handleFocus, true);
      panelElem.removeEventListener('click', handleFocus);
      delete panelElem.dataset.graphInstanceId;
      delete panelElem.__nvPanelTabDestroy;
      instance.destroy();
    }
  };
  // panelTabs can close a host while its asynchronous mount is still pending.
  panelElem.__nvPanelTabDestroy = lifecycle.destroy;
  registerPanelContentLifecycle(panelElem, lifecycle);
  try {
    await instance.init({ rootPath: panelVars.currentDirectory || '' });
    if (!instance.destroyed) instance.activate();
  } catch (err) {
    lifecycle.destroy();
    const errorElem = panelElem.querySelector('[data-graph-error]');
    if (errorElem) errorElem.textContent = 'Failed to initialize Graph Engine.';
    console.error('[GraphManager] Initialization failed:', err);
  }
  return lifecycle;
}

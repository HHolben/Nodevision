// Nodevision/ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Open.mjs
// This module opens terrain maps in the existing graphical editor workspace. It activates an already open document when possible and delegates new panel creation to the shared workspace loader.
import {cleanPath} from './Persistence.mjs';
export async function openTerrainMap(path){path=cleanPath(path);for(const root of document.querySelectorAll('[data-nv-map-editor]')){const api=root.__nvMapApi;if(api?.filePath!==path)continue;const cell=root.closest('.panel-cell'),host=root.closest('.nv-panel-tab-content'),tab=cell?.__nvPanelTabs?.tabs.find(t=>t.contentElement===host);if(tab){const {activatePanelTab}=await import('/panels/panelTabs.mjs');activatePanelTab(cell,tab.tabId);}api.activate();api.canvas?.focus();return api;}
 const {loadPanelIntoCell}=await import('/panels/workspace.mjs');await loadPanelIntoCell('GraphicalEditor',{id:'GraphicalEditor',filePath:path,displayName:path.split('/').pop()});}

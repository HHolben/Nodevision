// Nodevision/ApplicationSystem/public/Education/PanelNavigation.mjs
// This module activates the existing workspace tab containing a requested document or world element. It delegates tab ownership and activation to the shared panel infrastructure.
export async function activateElementTab(element){
 const cell=element?.closest('.panel-cell'),host=element?.closest('.nv-panel-tab-content'),tab=cell?.__nvPanelTabs?.tabs.find(t=>t.contentElement===host);
 if(tab){const {activatePanelTab}=await import('/panels/panelTabs.mjs');activatePanelTab(cell,tab.tabId);}
}

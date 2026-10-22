// Nodevision/ApplicationSystem/public/Voxels/GoxTabPath.mjs
// Updates existing native tab metadata after a successful GOX Save As operation.
export async function updateGoxTabPath(container,path){
 container.dataset.currentFilePath=path;const host=container.closest('.nv-panel-tab-content'),cell=container.closest('.panel-cell');if(host)host.dataset.currentFilePath=path;
 const tab=cell?.__nvPanelTabs?.tabs.find(t=>t.contentElement===host);if(!tab)return;
 const {refreshPanelTabMetadata}=await import('/panels/panelTabMetadata.mjs');const {renderPanelTabs}=await import('/panels/panelTabs.mjs');refreshPanelTabMetadata(tab,cell);renderPanelTabs(cell);
}

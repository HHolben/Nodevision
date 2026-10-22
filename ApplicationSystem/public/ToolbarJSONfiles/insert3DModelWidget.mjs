// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insert3DModelWidget.mjs
// One model selection form, with placement delegated to the originating editor.
import {loadModuleMapFamilies} from './insertMediaCommon.mjs';
import {renderInsertModel} from './insertMediaModel.mjs';
import {captureInsertMediaOriginContext,openInsertMediaPanel} from './insertMediaPanel.mjs';
import {setStatus} from '/StatusBar.mjs';
export async function openModelInsertion(){
 const originContext=captureInsertMediaOriginContext({familyKey:'Model',mediaFamily:'Model'}),world=['Virtual World Editing','VR World Editing'].includes(window.NodevisionState?.currentMode);
 const map=await loadModuleMapFamilies(),exts=[...new Set([...(map.extensionsByFamily.get('Model')||[]),'gox','glb','gltf'])];
 const panel=await openInsertMediaPanel('Insert 3D Model','Model',{originContext});
 renderInsertModel(panel.mount,exts,{target:world?'virtualWorld':'html',originContext:panel.originContext||originContext});return panel;
}
export function initToolbarWidget(){void openModelInsertion().catch(e=>setStatus('3D Model',e.message));}

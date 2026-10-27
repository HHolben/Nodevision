// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/RefreshSavedFileViews.mjs
// Routes persisted-file refreshes to matching mounted viewer roots, serializes reloads, and defers hidden or editable consumers without activating them.
import { fileViewRootPath } from './GetViewPanelElement.mjs';
import { sameSavePath } from '/ToolbarCallbacks/file/saveFile/utils.mjs';
import { updateViewPanel } from './UpdateViewPanel.mjs';
import { renderFile } from './RenderFile.mjs';
import { cleanupViewIframeActivation } from './InstallFileViewFocusHandler.mjs';
import { getNodevisionRouteBase } from '/utils/notebookPath.mjs';
const running=new WeakMap();
const roots=()=>[...document.querySelectorAll('[data-nv-file-view-root="true"], #element-view')];
const mounted=root=>root?.isConnected&&root.dataset.nvFileViewDestroyed!=='true';
function ready(root){const api=root.querySelector('[data-nv-gox]')?.__nvGoxApi;return mounted(root)&&!root.closest('[hidden],[aria-hidden="true"]')&&(!api||!api.editing&&!api.isDirty());}
export async function refreshSavedFileView(root,path){
  if(!ready(root)||!sameSavePath(fileViewRootPath(root),path))return false;
  const restoreToolbar=!!document.querySelector('#sub-toolbar [data-gox-block-controls]');
  const wasActive=root.contains(window.__nvGoxActive?.element);
  const shouldActivate=()=>wasActive&&window.activeCell?.contains(root)&&!root.closest('[hidden],[aria-hidden="true"]');
  root._dispose?.();root._dispose=null;cleanupViewIframeActivation(root);root.replaceChildren();
  const stillCurrent=()=>mounted(root)&&sameSavePath(fileViewRootPath(root),path);
  const success=await renderFile(path,root,getNodevisionRouteBase({route:/\.php$/i.test(path)?'php':'Notebook'}),{background:true,shouldActivate,restoreToolbar,isCurrent:stillCurrent,selectionPath:root.dataset.nvFileViewSelectionPath||path,selectionIsDirectory:root.dataset.nvFileViewSelectionIsDirectory==='true'});
  if(!stillCurrent())return false;
  if(!success)throw Error('Viewer could not reload the persisted file: '+path);
  return true;
}
function schedule(root){
  if(running.has(root))return running.get(root);
  const work=Promise.resolve().then(async()=>{
    while(ready(root)&&root.dataset.nvFileViewPendingSavedPath){
      const path=root.dataset.nvFileViewPendingSavedPath;delete root.dataset.nvFileViewPendingSavedPath;
      if(!sameSavePath(fileViewRootPath(root),path))continue;
      try{await updateViewPanel(path,{viewPanel:root,force:true,refreshOnly:true});}
      catch(error){console.error('[FileView] File saved, but viewer refresh failed:',path,error);}
    }
  }).finally(()=>running.delete(root));running.set(root,work);return work;
}
export function refreshViewsForSavedPath(path){
  if(!path)return Promise.resolve([]);
  return Promise.all(roots().filter(root=>mounted(root)&&sameSavePath(fileViewRootPath(root),path)).map(root=>{root.dataset.nvFileViewPendingSavedPath=path;return schedule(root);}));
}
export function resumeSavedFileViewRefreshes(){return Promise.all(roots().filter(root=>mounted(root)&&root.dataset.nvFileViewPendingSavedPath).map(schedule));}

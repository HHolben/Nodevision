// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/MetaWorldImportComponents/assetBrowser.mjs
// This file-manager-style browser opens one Notebook folder at a time, pages previews and cancels stale requests without blocking panel creation.
import {listNotebookAssetDirectory} from './importAssetApi.mjs';
import {renderAssetGrid} from './assetGrid.mjs';
export function createAssetBrowser(root,{onImport,onStatus,startDirectory='',extensions=null,actionLabel}={}) {
  const make=(tag,text,parent=root)=>{const node=document.createElement(tag);node.textContent=text||'';parent.append(node);return node;};
  const controls=make('div');controls.className='nv-mw-import-controls';
  const button=(label,action,parent=controls)=>{const node=make('button',label,parent);node.type='button';node.onclick=action;return node;};
  const home=button('Notebook',()=>open('')),up=button('Up',()=>open(directory.split('/').slice(0,-1).join('/')));
  const location=make('span','Notebook/',controls);location.setAttribute('aria-live','polite');
  const search=make('input','',controls);search.type='search';search.placeholder='Filter this folder';search.setAttribute('aria-label','Filter assets in this folder');
  const retry=button('Refresh',()=>open(directory));
  const folders=make('div'),grid=make('div');grid.className='nv-mw-import-grid';folders.className='nv-mw-import-controls';
  const more=button('Show more',()=>{limit+=60;draw();},root);more.hidden=true;
  let directory=startDirectory,entries=[],limit=60,request=0,controller,disposed=false;
  function draw() {
    folders.replaceChildren();
    const query=search.value.trim().toLowerCase(),visible=entries.filter(entry=>entry.name.toLowerCase().includes(query));
    const page=visible.slice(0,limit);
    for(const folder of page.filter(entry=>entry.isDirectory))button('📁 '+folder.name,()=>open(folder.notebookPath),folders);
    renderAssetGrid(grid,page.filter(entry=>!entry.isDirectory),{onImport,actionLabel});
    if(!page.some(entry=>!entry.isDirectory))grid.textContent=visible.length?'Choose a folder to find assets.':'No supported assets or folders match here.';
    more.hidden=visible.length<=limit;
    onStatus?.(`${visible.length} item(s) in this folder`);
  }
  async function open(path) {
    const id=++request;controller?.abort();controller=new AbortController();directory=path;entries=[];limit=60;search.value='';
    up.disabled=!path;location.textContent='Notebook/'+path;folders.replaceChildren();grid.textContent='Loading folder…';more.hidden=true;
    try {
      const next=await listNotebookAssetDirectory(path,{signal:controller.signal,extensions});
      if(disposed||id!==request)return;entries=next.filter(e=>e.isDirectory||!extensions||extensions.includes(e.extension?.replace(/^\./,'')));draw();
    }catch(error){if(disposed||id!==request||error.name==='AbortError')return;grid.textContent=error.message;onStatus?.('Unable to load folder. Use Refresh to retry, or Notebook to return to the root.');}
  }
  search.oninput=()=>{limit=60;draw();};
  void open(startDirectory);
  return ()=>{disposed=true;request++;controller?.abort();home.disabled=up.disabled=retry.disabled=true;};
}

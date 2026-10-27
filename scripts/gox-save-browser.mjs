// Nodevision/scripts/gox-save-browser.mjs
// Exercises persistence and optional real FileView refresh independently, including concurrent edits, multiple consumers, rejected writes and closed viewers.
export async function saveChecks(files,ok){
 const {renderGox}=await import('/Voxels/GoxPanel.mjs'),{encodeGox,decodeGox}=await import('/Voxels/GoxCodec.mjs'),{newModel,newLayer,setVoxel,getVoxel}=await import('/Voxels/VoxelModel.mjs');
 const {installFileViewLiveRefresh}=await import('/PanelInstances/ViewPanels/FileViewParts/InstallFileViewFocusHandler.mjs');
 const {FileViewModuleState}=await import('/PanelInstances/ViewPanels/FileViewParts/CancelScheduledSelectedFileViewRender.mjs');
 const {updateViewPanel}=await import('/PanelInstances/ViewPanels/FileViewParts/UpdateViewPanel.mjs');
 const {default:saveFile}=await import('/ToolbarCallbacks/file/saveFile.mjs');
 const tick=()=>new Promise(r=>setTimeout(r,20));async function until(check,label){for(let i=0;i<150;i++){if(check())return;await tick();}throw Error(label);}
 const model=newModel();model.layers[0].name='Base';model.layers.push(newLayer('Hidden'));model.layers[1].visible=false;setVoxel(model.layers[1],[-17,3,33],[12,23,34,127]);model.extras=[{type:'CAMR',payload:new Uint8Array([1,2,3])}];
 files.set('/Notebook/save.gox',await encodeGox(model));files.set('/Notebook/other.gox',await encodeGox(newModel()));
 const editor=document.createElement('div');editor.className='panel-cell';editor.style.cssText='width:600px;height:400px';document.body.append(editor);window.activeCell=editor;
 ok(await renderGox('save.gox',editor,true),'save fixture editor opens');const api=editor.querySelector('[data-nv-gox]').__nvGoxApi;
 installFileViewLiveRefresh();FileViewModuleState.lastRenderedPath='save.gox';
 const errors=[],warnings=[],oldError=console.error,oldWarn=console.warn;console.error=(...args)=>{errors.push(args.map(String).join(' '));};console.warn=(...args)=>{warnings.push(args.map(String).join(' '));};
 const oldFetch=window.fetch;let failWrite=false,delayWrite=false,releaseWrite,startedWrite,failRead=false,delayRead=false,releaseRead,startedRead=false,events=0;
 const onSaved=()=>events++;window.addEventListener('nodevision-file-saved',onSaved);
 window.fetch=async(url,options)=>{
   if(url==='/api/save'){
     if(failWrite)return new Response(JSON.stringify({success:false,error:'Disk unavailable'}),{status:500});
     if(delayWrite){startedWrite=true;await new Promise(resolve=>releaseWrite=resolve);}
   }
   if(url==='/Notebook/save.gox'&&delayRead){startedRead=true;await new Promise(resolve=>releaseRead=resolve);}
   if(url==='/Notebook/save.gox'&&failRead){failRead=false;return new Response('unavailable',{status:503});}
   return oldFetch(url,options);
 };
 const viewers=[];async function viewer(path,hidden=false){const root=document.createElement('div');root.dataset.nvFileViewRoot='true';root.dataset.nvFileViewRenderedPath=path;root.style.cssText='width:400px;height:300px';document.body.append(root);await renderGox(path,root,false,{background:true});root.hidden=hidden;viewers.push(root);return root;}
 const viewerApi=root=>root.querySelector('[data-nv-gox]')?.__nvGoxApi;
 try{
   await api.run('add',{at:[1,2,3],color:[20,30,40,127]});ok(await saveFile(),'standard Save succeeds without View panel');await tick();ok(!api.doc.dirty&&events===1,'successful write clears dirty state and notifies once');
   ok(await updateViewPanel('save.gox')===false,'absent View panel is a normal no-op');ok(!errors.some(e=>e.includes('panel element not found')),'no missing-panel diagnostic');
   let restored=await decodeGox(files.get('/Notebook/save.gox'));ok(getVoxel(restored.layers[0],[1,2,3]).join(',')==='20,30,40,127'&&!restored.layers[1].visible&&restored.layers[1].name==='Hidden'&&getVoxel(restored.layers[1],[-17,3,33])[3]===127&&restored.extras[0].payload[2]===3,'meaningful GOX round trip preserves voxels alpha layers visibility and metadata');
   const a=await viewer('save.gox'),b=await viewer('/Notebook/save.gox'),hidden=await viewer('save.gox',true),other=await viewer('other.gox'),otherApi=viewerApi(other),hiddenApi=viewerApi(hidden);
   await api.run('tool',{name:'paint'});await api.run('select',{kind:'all'});const camera=api.viewport.camera.position.clone(),selection=[...api.doc.selection].join(),layers=window.GOXLayersContext;
   await api.run('add',{at:[2,2,3],color:[99,88,77,255]});ok(await saveFile(),'standard Save with multiple viewers succeeds');await until(()=>[a,b].every(root=>viewerApi(root)&&!viewerApi(root).loading&&getVoxel(viewerApi(root).doc.active,[2,2,3])[0]===99),'both matching viewers refreshed');
   ok(window.__nvGoxActive===api&&api.tool==='paint'&&api.viewport.camera.position.equals(camera)&&[...api.doc.selection].join()===selection&&window.GOXLayersContext===layers,'refresh preserves editor tool camera selection layers and ownership');ok(viewerApi(other)===otherApi&&viewerApi(hidden)===hiddenApi,'unrelated and hidden panels not reloaded');
   hidden.hidden=false;window.dispatchEvent(new CustomEvent('activePanelChanged'));await until(()=>viewerApi(hidden)!==hiddenApi&&viewerApi(hidden)?.loading===false,'hidden viewer refreshes when activated');
   delayWrite=true;startedWrite=false;await api.run('add',{at:[3,2,3],color:[3,3,3,255]});const pending=api.save();await until(()=>startedWrite,'write pending');await api.run('add',{at:[4,2,3],color:[4,4,4,255]});a._dispose();a.remove();releaseWrite();delayWrite=false;ok(await pending,'closing viewer during save does not reject write');ok(api.doc.dirty,'edit made while saving remains dirty');restored=await decodeGox(files.get('/Notebook/save.gox'));ok(getVoxel(restored.layers[0],[3,2,3])[3]===255&&!getVoxel(restored.layers[0],[4,2,3])[3],'save uses the requested immutable revision');
   failWrite=true;const beforeEvents=events,beforeBytes=files.get('/Notebook/save.gox');let rejected=false;try{await api.save();}catch(e){rejected=e.message.includes('Disk unavailable');}ok(rejected&&api.doc.dirty&&events===beforeEvents&&files.get('/Notebook/save.gox')===beforeBytes,'persistence failure retains dirty document and emits no success');failWrite=false;
   await Promise.all([api.save(),api.save()]);ok(!api.doc.dirty,'repeated queued saves recover after rejection');await until(()=>viewerApi(b)?.loading===false&&getVoxel(viewerApi(b).doc.active,[4,2,3])[3]===255,'latest queued save reaches viewer');
   hidden._dispose();hidden.remove();await tick();failRead=true;const previous=viewerApi(b);await api.run('add',{at:[5,2,3],color:[5,5,5,255]});ok(await api.save(),'viewer read failure does not reject successful persistence');await until(()=>errors.some(e=>e.includes('File saved, but viewer refresh failed')),'refresh failure diagnostic');ok(!api.doc.dirty&&getVoxel((await decodeGox(files.get('/Notebook/save.gox'))).layers[0],[5,2,3])[3]===255,'viewer failure cannot change persisted bytes or dirty state');
   delayRead=true;startedRead=false;const refresh=await import('/PanelInstances/ViewPanels/FileViewParts/RefreshSavedFileViews.mjs');const loading=refresh.refreshViewsForSavedPath('save.gox');await until(()=>startedRead,'viewer read in progress');b.remove();await tick();releaseRead();delayRead=false;await loading;ok(window.__nvGoxActive===api,'viewer closed during refresh cannot activate after removal');other._dispose();other.remove();
   const dirtyView=await viewer('save.gox');const dirtyApi=viewerApi(dirtyView);await dirtyApi.run('mode',{name:'build'});await dirtyApi.run('add',{at:[9,9,9],color:[9,9,9,255]});api.element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await api.save();await tick();ok(viewerApi(dirtyView)===dirtyApi&&dirtyApi.doc.dirty,'editable viewer keeps its own unsaved changes');dirtyView._dispose();dirtyView.remove();
   const activeView=await viewer('save.gox'),activeApi=viewerApi(activeView);window.activeCell=activeView;activeApi.element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await saveFile();await until(()=>viewerApi(activeView)!==activeApi&&viewerApi(activeView)?.loading===false,'active viewer reload completes');ok(window.__nvGoxActive===viewerApi(activeView),'saving active viewer restores its own command context');activeView._dispose();activeView.remove();window.activeCell=editor;api.element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
   const readonly=await viewer('readonly.gox'),readonlyApi=viewerApi(readonly),readonlyBytes=files.get('/Notebook/readonly.gox');window.activeCell=readonly;ok(await saveFile(),'read-only viewer can save original bytes');ok(files.get('/Notebook/readonly.gox').every((v,i)=>v===readonlyBytes[i]),'unsupported GOX preserves byte-exact original data');readonly._dispose?.();readonly.remove();window.activeCell=editor;
   files.set('/Notebook/refresh.txt','Updated text');const textView=document.createElement('div');textView.dataset.nvFileViewRoot='true';textView.dataset.nvFileViewRenderedPath='refresh.txt';document.body.append(textView);viewers.push(textView);await refresh.refreshViewsForSavedPath('refresh.txt');ok(textView.textContent.includes('Updated text'),'non-GOX text viewer still refreshes');textView.remove();

   const {dispatchNodevisionCommand}=await import('/Commands/NodevisionCommandDispatcher.mjs');ok(await dispatchNodevisionCommand('voxel.execute',['save',{}]),'terminal Save uses same persistence workflow');
   api.viewport.renderer.domElement.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));await api.saving;ok(!api.doc.dirty,'Ctrl+S works for unmodified document');
   const dispatch=window.dispatchEvent;window.dispatchEvent=function(event){if(event.type==='nodevision-file-saved')throw Error('notification fixture failure');return dispatch.call(this,event);};try{ok(await api.save(),'notification failure does not reject persistence');}finally{window.dispatchEvent=dispatch;}ok(warnings.some(e=>e.includes('completion notification failed')),'notification diagnostic retained');
   const hiddenEditor=document.createElement('div');hiddenEditor.hidden=true;hiddenEditor.dataset.nvGox='';hiddenEditor.__nvGoxApi={save(){throw Error('wrong hidden editor');}};editor.prepend(hiddenEditor);ok(await saveFile(),'File Save ignores hidden GOX tabs');hiddenEditor.remove();
   ok(!errors.some(e=>e.includes('panel element not found')),'no missing-panel errors across lifecycle cases');
 }finally{window.fetch=oldFetch;window.removeEventListener('nodevision-file-saved',onSaved);console.error=oldError;console.warn=oldWarn;for(const root of viewers){root._dispose?.();root.remove();}editor._dispose();editor.remove();}
}

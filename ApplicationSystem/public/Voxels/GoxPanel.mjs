// Nodevision/ApplicationSystem/public/Voxels/GoxPanel.mjs
// Integrates GOX documents with native panel lifecycle, binary save, tools, shortcuts and Layers providers.
import { buildDefaults } from './VoxelBuildSettings.mjs';
import { buildAction,drawingActions } from './VoxelBuildActions.mjs';
import { geometry,symmetric,constrain } from './VoxelBuildGeometry.mjs';
import { updateGoxTabPath } from './GoxTabPath.mjs';
import { decodeGox,encodeGox } from './GoxCodec.mjs';
import { defaultBrush,brushSettings } from './VoxelBrush.mjs';
import { getVoxel } from './VoxelModel.mjs';
import { VoxelDocument } from './VoxelOperations.mjs';
import { VoxelViewport } from './VoxelViewport.mjs';
import { controls,pointerTools,tools } from './GoxControls.mjs';
import { installLayers,openLayers } from './GoxLayers.mjs';
import { registerPanelActiveTool,notifyActiveToolChanged } from '/CursorFamilies/PanelActiveTool.mjs';
import { updateToolbarState } from '/panels/createToolbar.mjs';
import { saveViaApi,notifyFileSaved } from '/ToolbarCallbacks/file/saveFile/utils.mjs';
const views={front:[0,-1,0],rear:[0,1,0],left:[-1,0,0],right:[1,0,0],top:[0,0,1],bottom:[0,0,-1]};
const inspect=new Set(['select','active-layer','copy','cancel']);
export async function renderGox(filePath,container,editing=false){
  container.__nvActiveEditorCleanup?.();container._dispose?.();container.replaceChildren();
  const abort=new AbortController(),root=document.createElement('div'),status=document.createElement('div'),viewportHost=document.createElement('div');root.dataset.nvGox='';root.style.cssText='display:flex;flex-direction:column;height:100%;min-height:200px';status.setAttribute('role','status');status.textContent='Loading GOX…';viewportHost.style.cssText='position:relative;flex:1;min-height:160px;overflow:hidden';container.append(root);root.append(status);
  let viewport,unregister,releaseLayers,observer;const cleanup=()=>{if(abort.signal.aborted)return;abort.abort();observer?.disconnect();unregister?.();releaseLayers?.();viewport?.dispose();if(window.__nvGoxActive===api){delete window.__nvGoxActive;if(window.NodevisionState)window.NodevisionState.fileIsDirty=false;}root.__nvGoxApi=null;if(container.__nvActiveEditorCleanup===cleanup)container.__nvActiveEditorCleanup=null;if(container._dispose===cleanup)container._dispose=null;};
  const api={loading:true,element:root,isDirty:()=>!!api.doc?.dirty,viewVisibility:new Map(),filePath,editing,status,interaction:editing?'build':'view',build:buildDefaults(),brush:defaultBrush(),tool:'orbit',getSelectedTool:()=>api.tool,activateTool:name=>api.safe('tool',{name}),safe:async(action,args)=>{try{return await api.run(action,args);}catch(err){status.textContent=err.message;return false;}}};root.__nvGoxApi=api;container.__nvActiveEditorCleanup=cleanup;container._dispose=cleanup;
  try{
    const path=String(filePath).replace(/^\/?Notebook\//,'').replace(/^\//,'');if(path.split('/').includes('..'))throw Error('Invalid notebook path');const response=await fetch('/Notebook/'+path.split('/').map(encodeURIComponent).join('/'),{signal:abort.signal});if(!response.ok)throw Error('Could not load GOX ('+response.status+')');
    const model=await decodeGox(await response.arrayBuffer(),{signal:abort.signal,progress:n=>status.textContent=`Loading GOX ${Math.round(n*100)}%`});abort.signal.throwIfAborted();
    api.doc=new VoxelDocument(model,()=>{viewport?.update(api.displayModel(),api.doc.selection,api.doc.layer);if(api.build.bounds)viewport?.buildOverlay.settings(api.build,api.brush.symmetry);api.refreshLayers?.();root.dataset.modified=String(api.doc.dirty);if(window.__nvGoxActive===api)window.NodevisionState.fileIsDirty=api.doc.dirty;status.textContent=(api.doc.dirty?'Modified · ':'')+(api.editing?'Editing':'Viewing')+' · '+model.warnings.join(' ');});api.voxel=pos=>getVoxel(api.doc.active,pos);api.voxelAtLayer=(layer,pos)=>getVoxel(model.layers[layer],pos);api.displayModel=()=>({...model,layers:model.layers.map((l,i)=>({...l,visible:api.viewVisibility.get(i)??l.visible}))});
    const snapshot=()=>({...model,extras:model.extras.slice(),layers:model.layers.map(l=>({...l,attributes:new Map(l.attributes),chunks:new Map(l.chunks)}))});
    api.save=(destination=api.filePath)=>{
      if(api.loading||abort.signal.aborted)throw Error('Document is not ready');
      if(!/\.gox$/i.test(destination))throw Error('Save destination must end in .gox');
      api.doc.commit();const revision=api.doc.revision,document=snapshot();
      const write=async()=>{const bytes=await encodeGox(document,{signal:abort.signal});let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));abort.signal.throwIfAborted();await saveViaApi({path:destination,content:btoa(binary),encoding:'base64',mimeType:'application/octet-stream'});if(destination===api.filePath)api.doc.savedRevision=revision;notifyFileSaved(destination);if(!abort.signal.aborted)api.doc.onChange();return true;};
      api.saving=(api.saving||Promise.resolve()).catch(()=>{}).then(write);return api.saving;
    };
    api.run=async(action,args={})=>{
      if(abort.signal.aborted)throw Error('Document has closed');
      if(api.loading)throw Error('Document is still loading');
      const handled=buildAction(api,action,args);if(handled)return handled;
      if(action==='save')return api.save();
      if(action==='save-as'){if(typeof args.path!=='string'||!args.path.trim())throw Error('Choose a GOX save destination');api.doc.commit();const revision=api.doc.revision;await api.save(args.path);api.filePath=args.path;api.doc.savedRevision=revision;await updateGoxTabPath(container,args.path);if(window.__nvGoxActive===api)activate();api.doc.onChange();return true;}
      if(action==='download'){api.doc.commit();const blob=new Blob([await encodeGox(snapshot(),{signal:abort.signal})],{type:'application/octet-stream'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=api.filePath.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
      if(action==='mode'){const mode=args.name||((args.editing??!api.editing)?'build':'view');if(!['view','build','selection'].includes(mode))throw Error('Unknown interaction mode');if(mode!=='view'&&model.readOnly)throw Error(model.warnings.join(' '));api.cancelTool?.();api.interaction=mode;api.editing=mode!=='view';api.viewVisibility.clear();await api.run('tool',{name:mode==='build'?'add':mode==='selection'?'select':'orbit'});api.syncBuildControls();activate();return api.doc.onChange();}
      if(action==='tool'){if(!tools.includes(args.name))throw Error('Unknown voxel tool');if(!api.editing&&!['orbit','select','pick'].includes(args.name))throw Error('Switch to Editor mode first');api.cancelTool?.();api.tool=args.name;api.toolSelect.value=args.name;viewport.controls.mouseButtons.LEFT=args.name==='orbit'?0:null;notifyActiveToolChanged(root);return;}
      if(action==='brush'){api.brush=brushSettings(args,api.brush);viewport.buildOverlay.settings(api.build,api.brush.symmetry);return;}
      if(action==='color')return api.pickColor(args.rgba);
      if(action==='pick')return api.pickColor(api.voxel(args.at));
      if(action==='camera'){if(args.view){if(!views[args.view])throw Error('Unknown camera view');return viewport.view(views[args.view]);}for(const name of ['position','target'])if(args[name]){if(!Array.isArray(args[name])||args[name].length!==3||args[name].some(v=>!Number.isFinite(v)))throw Error('Expected three finite camera coordinates');(name==='position'?viewport.camera.position:viewport.controls.target).fromArray(args[name]);}viewport.controls.update();return viewport.render();}
      if(action==='projection')return viewport.projection(!!args.orthographic);
      if(action==='frame')return viewport.frameModel(!!args.selection);
      if(action==='grid')return api.run('settings',{gridVisible:!!args.visible});
      if(action==='scale'){api.cancelTool?.();if(!Number.isFinite(args.value)||args.value<=0||args.value>1000)throw Error('Display scale must be between 0 and 1000');viewport.voxels.root.scale.setScalar(args.value);viewport.buildOverlay.settings(api.build,api.brush.symmetry);api.doc.onChange();return viewport.frameModel();}
      if(action==='layers')return openLayers(container);
      if(action==='layer'&&!api.editing&&args.kind==='visible'){api.viewVisibility.set(api.doc.layer,!!args.value);return api.doc.onChange();}
      if(action==='select')return api.doc.select(args,api.displayModel().layers[api.doc.layer]?.visible);
      if(action==='cancel'){api.previewOperation=null;api.cancelTool?.();return;}
      if(drawingActions.includes(action)){if(!api.editing)throw Error('Switch to Build Mode first');const params={...api.build,...args};if(params.to)params.to=constrain(params.to,params.at,api.build.constraint);return api.doc.execute('stamp',{points:symmetric([...geometry(action,params)],api.brush.symmetry,api.build.symmetryOrigin),color:args.color||api.color(),collision:params.collision});}
      if(['move','duplicate'].includes(action)&&args.offset)args={...args,offset:constrain(args.offset,[0,0,0],api.build.constraint)};
      args={collision:api.build.collision,...args};
      if(!api.editing&&!inspect.has(action))throw Error('Switch to Editor mode first');return api.doc.execute(action,args);
    };
    function activate(){api.activateLayers?.();window.__nvGoxActive=api;window.currentActiveFilePath=api.filePath;updateToolbarState({currentMode:api.editing?'GOXediting':'GOXviewing',activePanelType:api.editing?'GraphicalEditor':'ViewPanel',selectedFile:api.filePath,activeEditorFilePath:api.filePath,fileIsDirty:api.doc.dirty});}
    controls(api,root);root.append(viewportHost);viewport=new VoxelViewport(viewportHost);api.viewport=viewport;await viewport.voxels.load(model,{signal:abort.signal,progress:n=>status.textContent=`Meshing GOX: ${n} chunks`});abort.signal.throwIfAborted();viewport.update(model);viewport.frameModel();pointerTools(api,viewport,abort.signal);releaseLayers=installLayers(api);unregister=registerPanelActiveTool(root,api);api.editing=editing&&!model.readOnly;api.interaction=api.editing?'build':'view';api.loading=false;viewport.workplane=api.build;viewport.buildOverlay.settings(api.build);api.syncBuildControls();if(api.editing)await api.run('tool',{name:'add'});api.doc.onChange();activate();
    root.addEventListener('pointerdown',activate,{capture:true,signal:abort.signal});root.addEventListener('focusin',activate,{signal:abort.signal});
    root.addEventListener('keydown',e=>{const typing=e.target.matches('input,textarea,select,[contenteditable]');let action;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s')action='save';else if(!typing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')action=e.shiftKey?'redo':'undo';else if(!typing&&e.key==='Delete')action='delete';else if(e.key==='Escape')action='cancel';else if(!typing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==='g')action='settings-open';else if(!typing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==='b')action='mode';else if(!typing&&e.key==='Enter')action='finish';if(action){e.preventDefault();e.stopPropagation();api.safe(action);}},{signal:abort.signal});
    window.addEventListener('beforeunload',e=>{if(api.doc.dirty){e.preventDefault();e.returnValue='';}},{signal:abort.signal});
    observer=new MutationObserver(()=>{if(!root.isConnected)cleanup();});observer.observe(document.body,{childList:true,subtree:true});return true;
  }catch(err){const cancelled=abort.signal.aborted;cleanup();if(!cancelled)status.textContent='Could not open GOX: '+err.message;return false;}
}

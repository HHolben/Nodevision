// Nodevision/ApplicationSystem/public/ResourceDrop/InventoryResourceDrops.mjs
// Model drops reuse Notebook references or validate and import local files before adding reusable inventory items, without placing world geometry.
import {registerResourceDropTarget} from './ResourceDropTarget.mjs';
import {resourcePath,isResourceTransfer} from './ResourceTransfer.mjs';
import {worldAuthoringAllowed} from '../MetaWorld/WorldAuthoringPermissions.mjs';
export function installInventoryResourceDrops({panel,roots,getInventory}){
 let disposed=false,busy=false;const cleanup=[];
 function capture(root,resource,point){
  const context=window.VRWorldContext,inventory=getInventory();
  const validate=()=>{if(disposed||!inventory||window.VRWorldContext!==context||context?.panel!==panel||context.inventory!==inventory||!panel.isConnected||!worldAuthoringAllowed(context.movementState)||context.movementState?.playerMode!=='creative'||context.movementState?.worldMode==='2d')throw Error('Model drops require the active editable 3D world in Build mode.');};validate();
  if(!['gox','glb','gltf'].includes(resource.extension))throw Error('Drop a GOX, GLB or glTF model into inventory.');
  const target=point.target||document.elementFromPoint(point.clientX,point.clientY),slot=target?.closest?.('[data-hotbar-slot-index]'),index=slot&&root.contains(slot)?Number(slot.dataset.hotbarSlotIndex):undefined;
  return {label:index===undefined?'Add model to inventory':`Assign model to hotbar slot ${index+1}`,validate,async insert(){
   const {assignModelInventory}=await import('../Models/ModelWorldCommands.mjs');validate();
   const existing=inventory.items.find(i=>i.modelFile===resource.path),id=assignModelInventory(resource.path,existing?.modelPlacement||{},index,{autoAssign:false});
   if(index===undefined)inventory.setActiveCategory('tools');return {id,slot:index,modelFile:resource.path};
  }};
 }
 function error(root,message){root.dispatchEvent(new CustomEvent('nodevision-resource-drop-error',{bubbles:true,detail:{message}}));void import('../StatusBar.mjs').then(m=>m.setStatus('3D Model',message));}
 for(const root of roots){
  cleanup.push(registerResourceDropTarget(root,{capture:(resource,point)=>capture(root,resource,point)}));
  const isLocal=e=>!isResourceTransfer(e.dataTransfer)&&Array.from(e.dataTransfer?.types||[]).includes('Files');
  const over=e=>{if(!isLocal(e))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';};
  const drop=async e=>{
   if(!isLocal(e))return;e.preventDefault();e.stopPropagation();if(busy)return;busy=true;let written='';
   try{
    const files=[...e.dataTransfer.files];if(files.length!==1)throw Error('Drop one model at a time. For companion files, place the complete model folder in Notebook first.');
    const file=files[0],extension=file.name.split('.').at(-1).toLowerCase(),context=window.VRWorldContext,owner=context?.currentWorldPath||context?.state?.currentWorldPath||'',directory=owner?resourcePath(owner).split('/').slice(0,-1).join('/'):'';
    const path=[directory,'assets',crypto.randomUUID()+'-'+file.name.replace(/[^a-z0-9._-]/gi,'_')].filter(Boolean).join('/'),resource={path,name:file.name,extension},operation=capture(root,resource,e);
    const {validateModelFile}=await import('../Models/ValidateModelFile.mjs');await validateModelFile(file);operation.validate();
    const {readFileAsDataUrl,saveNotebookBinaryFromDataUrl}=await import('../ToolbarJSONfiles/insertMediaIO.mjs');const content=await readFileAsDataUrl(file);operation.validate();await saveNotebookBinaryFromDataUrl(path,content);written=path;
    operation.validate();const result=await operation.insert();root.dispatchEvent(new CustomEvent('nodevision-resource-inserted',{bubbles:true,detail:{resource,result}}));
   }catch(e){error(root,e.message+(written?' Imported file retained at '+written+'.':''));}finally{busy=false;}
  };
  root.addEventListener('dragover',over);root.addEventListener('drop',drop);cleanup.push(()=>{root.removeEventListener('dragover',over);root.removeEventListener('drop',drop);});
 }
 return ()=>{disposed=true;for(const remove of cleanup)remove();};
}

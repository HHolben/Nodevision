// Nodevision/ApplicationSystem/public/MetaWorld/Constructions/ConstructionTool.mjs
// Insert → Construction uses the native editable-world bridge and numeric settings dialog with a transient scene preview.
import {ensureEditableMetaWorldBridge} from '../../ToolbarJSONfiles/worldShapeWidget.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
import {definitionFields,field} from './Controls.mjs';
import {validateConstruction,SIZE} from './Definition.mjs';
export async function insertConstruction(){
 const context=window.VRWorldContext;if(!context||!worldAuthoringAllowed(context.movementState))throw Error('Open an editable Virtual World');
 const bridge=await ensureEditableMetaWorldBridge();if(!bridge?.createConstruction||context!==window.VRWorldContext)throw Error('Construction authoring is unavailable');
 const existing=context.panel.querySelector('[data-construction-settings]');if(existing){existing.focus();return;}
 const terrain=context.objects.find(o=>o.userData?.proceduralVoxelRuntime),origin=terrain?terrain.position.toArray().map((n,i)=>n+(i===1?(terrain.userData.proceduralVoxelRuntime.definition.heightLimits?.min||0):0)):[0,0,0];
 let def={schema:'nodevision-construction',version:2,id:'preview',name:'Construction',voxelSize:SIZE,gridOrigin:origin,position:(context.camera?.position.toArray()||origin).map((n,i)=>Math.floor((n-origin[i])/SIZE)),terrainVolumes:[{id:'preview-cut',type:'TerrainCut',shape:'box',position:[0,0,0],size:[16,16,16],operation:'subtract',active:true}],geometry:null},link='';
 const dialog=document.createElement('dialog');dialog.dataset.constructionSettings='';dialog.setAttribute('aria-label','Insert Construction');dialog.style.cssText='max-width:560px;max-height:80vh;overflow:auto';
 const title=document.createElement('h2');title.textContent='Insert Construction';const fields=document.createElement('div'),status=document.createElement('output');status.setAttribute('role','status');
 const note=document.createElement('p');note.textContent='Initial axis-aligned excavation volume. Y is up; one voxel is 0.25 m. The definition is saved beside this world in Constructions/.';dialog.append(title,note,fields);
 const THREE=context.THREE,preview=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xe5a133,wireframe:true,depthTest:false}));context.scene.add(preview);
 function render(){fields.replaceChildren();definitionFields(fields,def,patch=>{def={...def,...patch};try{def=validateConstruction(def);status.textContent='';preview.visible=true;render();}catch(e){status.textContent=e.message;preview.visible=false;}});for(let i=0;i<3;i++)field(fields,['Width','Height','Depth'][i]+' (voxels)',def.terrainVolumes[0].size[i],value=>{const next=structuredClone(def);next.terrainVolumes[0].size[i]=value;try{def=validateConstruction(next);render();}catch(e){status.textContent=e.message;}},'number');preview.position.fromArray(def.position.map((n,i)=>origin[i]+(n+def.terrainVolumes[0].size[i]/2)*SIZE));preview.scale.fromArray(def.terrainVolumes[0].size.map(n=>n*SIZE));}
 render();field(dialog,'Or link existing construction (relative to world)',link,value=>{link=value;preview.visible=!link;});dialog.append(status);
 const old=context.movementState.textEditing;context.movementState.textEditing=true;context.controls?.unlock?.();let closed=false;
 const observer=new MutationObserver(()=>{if(!dialog.isConnected)close();});
 function close(){if(closed)return;closed=true;observer.disconnect();preview.removeFromParent();preview.geometry.dispose();preview.material.dispose();dialog.remove();context.movementState.textEditing=old;context.movementState.skipClickFrame=true;}
 const create=document.createElement('button');create.textContent='Create / Link';create.onclick=async()=>{create.disabled=true;try{if(window.VRWorldContext!==context)throw Error('The active world changed');validateConstruction(def);const result=link?await bridge.linkConstruction(link):await bridge.createConstruction({name:def.name,position:def.position,size:def.terrainVolumes[0].size,gridOrigin:origin,geometry:def.geometry});const object=context.objects.find(o=>o.userData.metaWorldLayerId===result.id);close();context.objectInspector?.inspectTarget(object);}catch(e){status.textContent=e.message;create.disabled=false;}};
 const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=close;dialog.append(create,cancel);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 for(const name of ['keydown','keyup','pointerdown','mousedown','click'])dialog.addEventListener(name,e=>e.stopPropagation());context.panel.append(dialog);observer.observe(document.body,{childList:true,subtree:true});dialog.showModal();
}

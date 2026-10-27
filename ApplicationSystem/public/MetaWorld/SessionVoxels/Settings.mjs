// Nodevision/ApplicationSystem/public/MetaWorld/SessionVoxels/Settings.mjs
// G settings reuse the inventory tool configuration convention and shared GOX brush validation.
import {brushSettings} from '../../Voxels/VoxelBrush.mjs';
import {loadWorldObjectMaterialCatalog} from '../Materials/WorldObjectMaterialDefaults.mjs';
import {resolveWorldObjectMaterial} from '../Materials/WorldObjectMaterialResolver.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
export function openSessionVoxelSettings(){
 const ctx=window.VRWorldContext,api=ctx?.sessionVoxels;if(!api||!worldAuthoringAllowed(ctx.movementState)||ctx.movementState.playerMode!=='creative'||ctx.panel.querySelector('[data-session-voxel-settings]'))return false;
 api.finish();ctx.controls?.unlock?.();const dialog=document.createElement('dialog');dialog.dataset.sessionVoxelSettings='';dialog.style.cssText='color:var(--text-color,CanvasText);background:var(--panel-bg,Canvas);padding:20px;max-width:420px';
 const title=document.createElement('h3');title.textContent=api.constructionEdit?'Construction voxel tools':'Temporary voxel tools';const note=document.createElement('p');note.textContent=api.constructionEdit?'Editing only the focused construction. Save Construction publishes it; Revert restores its baseline. Ordinary temporary edits remain separate.':'Changes are temporary. File Save does not preserve them. Erase empties cells; Revert restores the persistent world.';dialog.append(title,note);
 const field=(label,input)=>{const row=document.createElement('label');row.style.cssText='display:flex;justify-content:space-between;gap:12px;margin:10px 0';row.append(label,input);dialog.append(row);return input;};
 const size=field('Brush size (voxels)',document.createElement('input'));size.type='number';size.min=1;size.max=16;size.value=api.settings.brush.size;
 const shape=field('Brush shape',document.createElement('select'));for(const v of ['box','sphere'])shape.add(new Option(v,v));shape.value=api.settings.brush.shape;
 const material=field('Material',document.createElement('select'));material.add(new Option(api.settings.material.materialId,api.settings.material.materialId));
 let catalog=[];loadWorldObjectMaterialCatalog().then(rows=>{if(!dialog.isConnected)return;catalog=Array.isArray(rows)?rows:rows?.materials||[];for(const row of catalog){const id=row.materialId||row.id;if(id&&![...material.options].some(o=>o.value===id))material.add(new Option(row.displayName||row.materialName||id,id));}}).catch(()=>{});
 const color=field('Color',document.createElement('input'));color.type='color';color.value='#'+api.settings.material.rgba.slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');let colorChanged=false;color.oninput=()=>{colorChanged=true;};
 const alpha=field('Alpha (1–255)',document.createElement('input'));alpha.type='number';alpha.min=1;alpha.max=255;alpha.value=api.settings.material.rgba[3];
 const status=document.createElement('p');status.setAttribute('role','status');dialog.append(status);
 const old=ctx.movementState.textEditing;ctx.movementState.textEditing=true;
 function close(){dialog.close();dialog.remove();ctx.movementState.textEditing=old;ctx.movementState.skipClickFrame=true;}
 const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;dialog.append(b);};
 button('Apply',async()=>{try{const brush=brushSettings({size:Number(size.value),shape:shape.value});const a=Number(alpha.value);if(!Number.isInteger(a)||a<1||a>255)throw Error('Alpha must be 1–255');let value=structuredClone(api.settings.material);
  if(material.value!==value.materialId){const entry=await resolveWorldObjectMaterial(material.value);const c=new ctx.THREE.Color(entry.rendering?.color||'#999999').convertLinearToSRGB();value={materialId:entry.materialId,materialFile:entry.materialFile,rgba:[c.r,c.g,c.b].map(n=>Math.round(n*255)).concat(a),solid:entry.collider?.solid===true,matterState:entry.matterState,customColor:true};}
  if(colorChanged){value.rgba=color.value.slice(1).match(/../g).map(n=>parseInt(n,16)).concat(a);value.customColor=true;}else {if(value.rgba[3]!==a)value.customColor=true;value.rgba[3]=a;}
  if(!worldAuthoringAllowed(ctx.movementState)||ctx.movementState.playerMode!=='creative')throw Error('Build mode is required');api.settings.material=value;api.settings.brush=brush;api.changed([]);close();
 }catch(e){status.textContent=e.message;}});
 button(api.constructionEdit?'Discard Construction Changes':'Clear Temporary Edits',()=>{if(window.confirm(api.constructionEdit?'Discard construction edits only?':`Discard all ${api.session.count} temporary cell edits? You can undo this action.`)){try{api.clear();status.textContent='Temporary edits cleared';}catch(e){status.textContent=e.message;}}});button('Cancel',close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});ctx.panel.append(dialog);dialog.showModal();return true;
}

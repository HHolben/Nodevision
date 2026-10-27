// Nodevision/ApplicationSystem/public/MetaWorld/SessionVoxels/Authoring.mjs
// Binds transient cell opinions to native terrain/construction runtimes and the shared history controls.
import {worldSession,closeWorldSession} from './WorldSession.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
import {strokePoints,voxel} from './SessionLayer.mjs';
import {raycastCells} from './Raycast.mjs';
export const TOOLS=['add','brush','erase','paint','pick','revert'];
export function installSessionAuthoring(bridge,{objects,filePath}){
 const recordTransaction=bridge.recordSessionTransaction.bind(bridge);
 const context=window.VRWorldContext,owner=worldSession(filePath),session=owner.layer;owner.adapter?.detach();let pending=new Map(),bindings=new Map(),detached=false,constructionEdit=null;
 const composed={get count(){return session.count+(constructionEdit?.layer.count||0);},opinion(p){const v=session.opinion(p);return v===undefined?constructionEdit?.opinionWorld(p):v;},renderOpinion(p){const v=session.opinion(p);return v===undefined&&constructionEdit?.runtime.root.visible===false?(constructionEdit.opinionWorld(p)===undefined?undefined:null):composed.opinion(p);},effective(p){const v=composed.opinion(p);return v===undefined?session.persistent(p):v;},*entries(){const values=new Map();for(const c of constructionEdit?.worldEntries()||[])values.set(c.at.join(','),c);for(const c of session.entries())values.set(c.at.join(','),c);yield*values.values();},column(x,z){return [...new Set([...session.column(x,z),...(constructionEdit?.columnWorld(x,z)||[])])];}};
 const terrain=()=>objects.map(o=>o.userData?.proceduralVoxelRuntime).filter(Boolean),constructions=()=>objects.map(o=>o.userData?.constructionRuntime).filter(r=>r?.active).sort((a,b)=>a.source.id.localeCompare(b.source.id));
 const ensureOrigin=()=>owner.origin||(owner.origin=terrain()[0]?.sessionOrigin()||null);
 const point=p=>p.map((v,i)=>(ensureOrigin()?.[i]||0)+(v+.5)*.25),cell=p=>p.map((v,i)=>Math.floor((v-(ensureOrigin()?.[i]||0))/.25+1e-8));
 const local=(r,p)=>point(p).map((v,i)=>Math.floor((v-r.sessionOrigin()[i])/.25));
 const valid=r=>ensureOrigin()&&r.sessionOrigin().every((n,i)=>Math.abs((n-owner.origin[i])/.25-Math.round((n-owner.origin[i])/.25))<1e-6);
 const contains=p=>terrain().some(r=>valid(r)&&local(r,p).every((n,i)=>n>=0&&n<r.generator.dimensions[i]));
 function persistent(p){const world=point(p);for(const r of constructions()){const value=r.sampleVoxel(world);if(value)return value;}
  for(const r of terrain()){const at=local(r,p);if(valid(r)&&at.every((n,i)=>n>=0&&n<r.generator.dimensions[i])){const value=r.getPersistentMaterial(...at);if(value)return value;}}return null;}
 function changed(points){for(const p of points)pending.set(p.join(','),p);if(context.panel)context.panel.dataset.temporaryVoxelEdits=String(session.count);context.inventory?.setTemporaryVoxelStatus?.(session.count,settings,constructionEdit?{count:constructionEdit.layer.count}:null);}
 const settings=owner.settings||(owner.settings={tool:'add',brush:{size:1,shape:'box',symmetry:[],axis:'free',plane:0},material:{materialId:'stone',rgba:[145,145,145,255],solid:true,customColor:true}});
 function sync(){if(detached)return;const current=[...terrain(),...constructions()];for(const r of current){const stamp=r.sessionOrigin?.().join(',')||r.root.position.toArray().join(',');if(bindings.get(r)===stamp)continue;bindings.set(r,stamp);
   if(r.bindSession&&r.generator){if(!valid(r))continue;r.bindSession(composed,p=>cell(p.map((v,i)=>r.sessionOrigin()[i]+(v+.5)*.25)));r.ready.then(()=>{if(!detached)changed([...composed.entries()].map(e=>e.at));});}
   else{r.bindSession({session:composed,toCell:cell});r.updateSession([...composed.entries()].map(e=>point(e.at)));}
  }for(const r of bindings.keys())if(!current.includes(r))bindings.delete(r);
 }
 function flush(){sync();if(!pending.size)return;const points=[...pending.values()];pending.clear();for(const r of terrain()){if(!valid(r))continue;const cells=points.map(p=>local(r,p)).filter(p=>p.every((n,i)=>n>=-1&&n<=r.generator.dimensions[i]));if(cells.length)r.invalidateSession(cells);}for(const r of constructions())r.updateSession(points.map(point));bridge.refreshPathTerrainSupport?.();}
 const allowed=()=>{if(detached||!worldAuthoringAllowed(context.movementState)||context.movementState?.playerMode!=='creative')throw Error('Voxel tools require an editable world in Build mode');};
 function validateMaterial(value){const v=voxel(value);for(const r of terrain())r.sessionMaterial(v);return v;}
 const api={session,settings,point,cell,contains,persistent,sync,flush,composed,
  get constructionEdit(){return constructionEdit;},setConstructionEdit(edit){const points=[...composed.entries()].map(e=>e.at);constructionEdit=edit;bindings.clear();changed(points.concat([...composed.entries()].map(e=>e.at)));flush();},get origin(){return ensureOrigin()?.slice();},
  raycast(origin,direction){if(constructionEdit)return constructionEdit.raycast(origin,direction,settings.tool);return raycastCells(origin,direction,p=>contains(p)?session.effective(p):null,{gridOrigin:ensureOrigin()||[0,0,0],includeEmpty:p=>settings.tool==='revert'&&session.opinion(p)!==undefined});},
  select(tool){allowed();constructionEdit?.setVolumeHandles?.(false);if(!TOOLS.includes(tool))throw Error('Unknown voxel tool');settings.tool=tool;context.inventory?.equipItemToActiveHand('session-voxel-'+tool);context.inventory?.setMenuOpen(false);changed([]);return true;},
  edit(tool,points,value=settings.material){allowed();sync();if(constructionEdit)return constructionEdit.editWorld(tool,points,value);if(tool==='pick'){const v=session.effective(points[0]);if(v){settings.material=structuredClone(v);changed([]);}return v;}
   if(['add','brush','paint'].includes(tool))value=validateMaterial(value);return session.edit(tool,points,value);},
  stroke(tool,from,to){return api.edit(tool,strokePoints(from,to,tool==='add'||tool==='pick'?{size:1,shape:'box'}:settings.brush));},
  begin(){allowed();if(constructionEdit)constructionEdit.begin();else session.begin();},finish(){if(constructionEdit)constructionEdit.layer.finish();else session.finish();flush();},cancel(){(constructionEdit?.layer||session).cancel();flush();},
  clear(){allowed();if(constructionEdit)constructionEdit.discard();else session.clear();flush();return true;},
  detach(){if(detached)return;constructionEdit?.suspend();session.finish();flush();detached=true;pending.clear();bindings.clear();if(owner.adapter===api)owner.adapter=null;},
  changed,record:tx=>recordTransaction(tx)
 };owner.adapter=api;bridge.sessionVoxels=api;bridge.getTemporaryVoxelCount=()=>session.count;bridge.clearTemporaryVoxels=()=>{if(constructionEdit)throw Error('Exit construction editing before clearing ordinary temporary edits');return api.clear();};context.sessionVoxels=api;if(context.panel)context.panel.__nvBeforeClose=()=>closeWorldSession(filePath);sync();changed([]);return api;
}

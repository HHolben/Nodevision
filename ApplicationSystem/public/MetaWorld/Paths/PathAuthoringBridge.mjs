// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathAuthoringBridge.mjs
// This module installs path editing on the existing world layer/history bridge and synchronizes derived terrain constraints after edits, deletion, regeneration, and history restoration.
import { validatePath } from './PathDefinition.mjs';
import { createPathObject } from './PathRuntime.mjs';
import { samplePath, ribbonForPath } from './PathGeometry.mjs';
export function installPathAuthoring(bridge,{THREE,scene,objects,colliders,layerEntries,worldData,changed,select}) {
  let previous=new Map();
  const terrainHeight=(x,z)=>{
    for(const o of objects) {
      const r=o.userData?.proceduralVoxelRuntime;if(!r)continue;
      const vx=Math.floor((x-o.position.x)/.25),vz=Math.floor((z-o.position.z)/.25),base=r.generator.base;
      if(vx>=0&&vz>=0&&vx<base.dimensions[0]&&vz<base.dimensions[2]) {
        const tx=(x-o.position.x)/.25-vx,tz=(z-o.position.z)/.25-vz;
        const h=(dx,dz)=>base.getTerrainHeight(Math.min(base.dimensions[0]-1,vx+dx),Math.min(base.dimensions[2]-1,vz+dz));
        return o.position.y+(r.definition.heightLimits?.min||0)+((h(0,0)*(1-tx)+h(1,0)*tx)*(1-tz)+(h(0,1)*(1-tx)+h(1,1)*tx)*tz)*.25;
      }
    }
    for(const collider of colliders)if(collider.target?.userData?.nvType==='terrain-surface') {
      const h=collider.sampleGroundY?.(x,z);if(Number.isFinite(h))return h;
    }
    return NaN;
  };
  bridge.syncPaths=()=>{
    const paths=[],next=new Map();let bounds=null;
    const extend=b=>{if(!b)return;bounds=bounds?{minX:Math.min(bounds.minX,b.minX),maxX:Math.max(bounds.maxX,b.maxX),minZ:Math.min(bounds.minZ,b.minZ),maxZ:Math.max(bounds.maxZ,b.maxZ)}:{...b};};
    for(const entry of layerEntries) {
      const r=entry.object3d?.userData?.pathRuntime;if(!r)continue;
      const def=r.serialize();
      const fingerprint=entry.object3d.uuid+JSON.stringify(def)+objects.filter(o=>o.userData?.proceduralVoxelRuntime||o.userData?.nvType==='terrain-surface').map(o=>o.uuid+o.position.toArray()+(o.geometry?.attributes?.position?.version||0)).join();
      const old=previous.get(def.id);
      if(old?.fingerprint!==fingerprint){
        try{r.rebuild(terrainHeight);r.warning='';}catch(error){r.warning=error.message;r.retainGeometry();}
        extend(old?.bounds);extend(r.ribbon?.bounds);
      }
      if(r.ribbon){paths.push(r.ribbon);next.set(def.id,{fingerprint,bounds:r.ribbon.bounds});}
    }
    for(const [id,old] of previous)if(!next.has(id))extend(old.bounds);
    previous=next;
    if(bounds)for(const o of objects)o.userData?.proceduralVoxelRuntime?.setPathConstraints(paths,bounds);
  };
  bridge.getPathDefinition=id=>layerEntries.find(e=>e.id===id)?.object3d?.userData?.pathRuntime?.serialize();
  bridge.updatePath=(id,patch)=>{
    const entry=layerEntries.find(e=>e.id===id),old=entry?.object3d?.userData?.pathRuntime;
    if(id&&!old)throw Error('Path no longer exists.');
    const def=validatePath({...old?.serialize(),...patch,id:id||crypto.randomUUID()});
    ribbonForPath(def,samplePath(THREE,def,terrainHeight));
    const mesh=createPathObject(THREE,def,colliders,terrainHeight);
    bridge.recordHistory();
    if(entry){const i=worldData.objects.indexOf(entry.def);worldData.objects[i]=def;old.dispose();objects.splice(objects.indexOf(entry.object3d),1);entry.def=def;entry.object3d=mesh;}
    else {worldData.objects.push(def);layerEntries.push({id:def.id,def,object3d:mesh});}
    mesh.userData.onBreakTarget=()=>bridge.removeObjectLayer(def.id);
    scene.add(mesh);objects.push(mesh);bridge.syncPaths();changed(def.id);select(def.id);return def;
  };
  bridge.syncPaths();
  for(const name of ['removeObjectLayer','setObjectVisibility','regenerateVoxelWorld','addVoxelWorld','undo','redo']) {
    const original=bridge[name];bridge[name]=function(...args){const result=original.apply(this,args);bridge.syncPaths();return result;};
  }
  let last='',pending=false,changedAt=0;
  bridge.updatePathTransforms=()=>{
    const stamp=objects.filter(o=>o.userData?.pathRuntime||o.userData?.proceduralVoxelRuntime||o.userData?.nvType==='terrain-surface').map(o=>o.uuid+o.position.toArray()+o.visible+(o.geometry?.attributes?.position?.version||0)).join();
    if(stamp!==last){last=stamp;pending=true;changedAt=performance.now();}
    if(pending&&performance.now()-changedAt>=120){pending=false;bridge.syncPaths();}
  };
}

// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldAuthoringBridge.mjs
// This adapter inserts and regenerates procedural terrain through the existing world hierarchy and snapshot history. It owns no global scene state and disposes the replaced runtime before registering its successor.
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { validateVoxelWorld } from './VoxelWorldDefinition.mjs';
export function installVoxelWorldAuthoring(bridge, { THREE, scene, objects, colliders, waterVolumes, layerEntries, worldData, changed, select, camera }) {
  const entryFor = id => layerEntries.find(entry=>entry.id===id && entry.def.type==='procedural-voxel-world');
  function register(def, previous = null) {
    const mesh = createProceduralVoxelWorld(THREE, def, colliders);
    bridge.recordHistory();
    if (previous) {
      const old = previous.object3d;
      old?.userData?.proceduralVoxelRuntime?.dispose();
      const index = objects.indexOf(old); if(index>=0)objects.splice(index,1);
      for(let i=(waterVolumes?.length || 0)-1;i>=0;i--)if(waterVolumes[i]?.target===old)waterVolumes.splice(i,1);
      const at = worldData.objects.indexOf(previous.def); worldData.objects[at] = def;
      previous.def=def; previous.object3d=mesh;
    } else {
      (worldData.objects ||= []).push(def); layerEntries.push({id:def.id,def,object3d:mesh});
    }
    scene.add(mesh); objects.push(mesh);
    mesh.userData.isSolid=true;
    changed(def.id); select(def.id);
    // The editor's existing frame loop advances this runtime one chunk at a time.
    mesh.userData.proceduralVoxelRuntime.ready.then(ready=>{
      if(ready && objects.includes(mesh)) mesh.userData.proceduralVoxelRuntime.update(camera?.position || mesh.position);
    });
    return def;
  }
  bridge.getVoxelWorldDefinition = id => {
    const entry=entryFor(id); return entry?.object3d?.userData?.proceduralVoxelRuntime?.serialize() || null;
  };
  bridge.addVoxelWorld = source => {
    if(layerEntries.some(entry=>entry.def.type==='procedural-voxel-world')) throw Error('This scene already has a Voxel World. Select it and use Edit Generation Parameters, or delete it before inserting another.');
    const def=validateVoxelWorld(structuredClone(source));
    const ids=new Set(layerEntries.map(entry=>entry.id));
    const stem=def.id; let n=2; while(ids.has(def.id))def.id=stem+'-'+n++;
    return register(def);
  };
  bridge.regenerateVoxelWorld = (id, source) => {
    const entry=entryFor(id); if(!entry)throw Error('The selected Voxel World no longer exists.');
    const current=bridge.getVoxelWorldDefinition(id);
    const def=validateVoxelWorld({...structuredClone(source),id,position:current.position,visible:current.visible,hidden:current.hidden});
    return register(def,entry);
  };
}

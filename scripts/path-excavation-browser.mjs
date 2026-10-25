// Nodevision/scripts/path-excavation-browser.mjs
// Exercises live excavation authoring, transient previews, bridge collision, history and shared representation occupancy within the real Path browser fixture.
export async function checkPathExcavation({THREE,context,bridge,runtime,ok,saveReload}){
  const read=()=>runtime.generator.getVoxel(32,8,32),original=read();
  const def=bridge.updatePath(null,{controlPoints:[[4,2,8],[24,2,8]],elevationMode:'authored',interpolation:'straight',width:3,upperClearance:3,leftClearance:1,rightClearance:.5,lowerClearance:0});
  const get=()=>context.objects.find(o=>o.userData.metaWorldLayerId===def.id).userData.pathRuntime;
  await get().ready;ok(def.terrainInteraction==='excavate','new paths excavate by default');ok(!get().materialError,'excavated gravel material resolves');
  ok(read()===0&&runtime.generator.getVoxel(32,7,32)===11,'live bounded tunnel and gravel roadbed');
  ok(runtime.generator.getVoxel(32,20,32)===runtime.generator.base.getVoxel(32,20,32),'tunnel roof preserved');
  ok(get().surface.triangles.length===0,'supported tunnel suppresses plane');
  const input=document.querySelector('[data-path-properties] [aria-label="Left Clearance (m)"]');ok(input,'inspector clearance controls');input.value=1.5;input.dispatchEvent(new Event('change'));ok(bridge.getPathDefinition(def.id).leftClearance===1.5,'clearance editable');
  const {pathCommand}=await import('/MetaWorld/Paths/PathTool.mjs');await pathCommand(['clearance-preview',{id:def.id,visible:true}]);ok(get().showClearanceEnvelope,'command enables envelope');ok(!('showClearanceEnvelope' in get().serialize()),'preview absent from persistence');
  const occupancy=runtime.generator.generateChunk(1,0,1).slice(),box=context.objects.find(o=>o.userData.metaWorldLayerId==='keep-box');
  for(let i=0;i<100;i++)runtime.update(new THREE.Vector3(16,2,8));
  await bridge.setTerrainRepresentation('hills','polygonal');ok(runtime.representation==='polygonal','polygonal tunnel mode');
  ok(runtime.generator.generateChunk(1,0,1).every((n,i)=>n===occupancy[i]),'representation retains identical modified occupancy');ok(context.objects.includes(box),'independent object retained');
  await bridge.setTerrainRepresentation('hills','voxel');
  ({bridge,runtime}=await saveReload());await runtime.ready;
  ok(bridge.getPathDefinition(def.id).leftClearance===1.5&&read()===0,'HTML save/reload preserves clearance and excavation');ok(!get().showClearanceEnvelope,'reloaded path hides transient preview');
  bridge.updatePath(def.id,{controlPoints:[[4,80,8],[24,80,8]]});ok(read()===original,'moving tunnel restores upstream terrain');ok(get().surface.triangles.length>0,'elevated path renders bridge');
  const mesh=context.objects.find(o=>o.userData.metaWorldLayerId===def.id);ok(mesh.userData.colliderRef.sampleGroundY(12,8)===80,'bridge collision matches surface');ok(runtime.generator.getVoxel(48,319,32)===0,'bridge does not fill below');
  bridge.undo();runtime=context.objects.find(o=>o.userData.proceduralVoxelRuntime).userData.proceduralVoxelRuntime;await runtime.ready;ok(runtime.generator.getVoxel(32,8,32)===0,'undo restores tunnel modifier');
  bridge.redo();runtime=context.objects.find(o=>o.userData.proceduralVoxelRuntime).userData.proceduralVoxelRuntime;await runtime.ready;ok(get().surface.heightAt(12,8)===80,'redo restores bridge');
  bridge.removeObjectLayer(def.id);ok(runtime.generator.getVoxel(32,8,32)===original,'deletion restores terrain');
  return {bridge,runtime};
}

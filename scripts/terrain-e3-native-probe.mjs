// Nodevision/scripts/terrain-e3-native-probe.mjs
// Verify the actual Editor/Viewer installed polygonal buffers against composed source extraction, including corrected normals. This runs only inside the production browser regression fixture, never in ordinary rendering.
import {surfaceNetSteps} from '/MetaWorld/TerrainRepresentation/SurfaceNets.mjs';
import {naturalGroundNormals} from '/MetaWorld/TerrainRepresentation/GroundNormals.mjs';
import {drainSteps} from '/MetaWorld/ProceduralVoxelWorld/ProgressiveTerrain.mjs';
export async function verifyInstalledGroundNormals(runtime){
 const result={style:runtime.polygonalGroundStyle,chunksChecked:0,changedNormalComponents:0};
 for(const entry of [...runtime.manager.loaded.values()]){
  if(!entry.mesh||!entry.data)continue;
  const expected=drainSteps(surfaceNetSteps(entry.data,entry.cell,runtime.generator.getRenderVoxel,runtime.polygonalGroundStyle==='smooth-natural'?naturalGroundNormals(runtime.generator,entry.cell):null)),original=drainSteps(surfaceNetSteps(entry.data,entry.cell,runtime.generator.getRenderVoxel));
  for(const [attribute,key] of [['position','positions'],['normal','normals'],['uv','uvs']]){
   const installed=entry.mesh.geometry.attributes[attribute].array;if(installed.length!==expected[key].length)throw Error('Installed polygonal '+attribute+' count mismatch');
   for(let i=0;i<installed.length;i++)if(installed[i]!==Math.fround(expected[key][i]))throw Error('Installed polygonal '+attribute+' differs from source at '+i);
  }
  for(let i=0;i<expected.normals.length;i++)if(Math.fround(expected.normals[i])!==Math.fround(original.normals[i]))result.changedNormalComponents++;
  result.chunksChecked++;if(result.chunksChecked>=8)break;await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(!result.chunksChecked)throw Error('No installed polygonal terrain to verify');
 return result;
}

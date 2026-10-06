// Nodevision/scripts/voxel-biome-benchmark.mjs
// This benchmark measures deterministic point sampling across bounded terrain coordinates without constructing a full-world voxel array.
import { createVoxelGenerator } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
const generator=createVoxelGenerator({size:[1000,128,1000],generator:{seed:123456}}),count=10000;
const cells=Array.from({length:count},(_,i)=>{const x=(i*37)%4000,z=(i*71)%4000;return [x,generator.getTerrainHeight(x,z)-1,z];});
function measure(fn){const start=performance.now();for(const [x,y,z] of cells)fn(x,y,z);return performance.now()-start;}
console.log(JSON.stringify({samples:count,biomeSamplingMs:measure((x,y,z)=>generator.getBiome(x,z)),surfaceMaterialSamplingMs:measure((x,y,z)=>generator.getVoxelMaterialId(x,y,z)),repeatSurfaceSamplingMs:measure((x,y,z)=>generator.getVoxelMaterialId(x,y,z))}));

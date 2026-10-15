// Nodevision/scripts/aegean-mesher-benchmark.mjs
// This paired CPU benchmark alternates reference and greedy meshing on identical generated chunks to compare representation cost independently of generator or machine changes.
import { createVoxelGenerator } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import { meshVoxelChunk } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelChunkMesher.mjs';
import { meshGreedyVoxelChunk } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelGreedyMesher.mjs';
import { AEGEAN_DEFAULTS } from '../ApplicationSystem/public/MetaWorld/Aegean/AegeanDefinition.mjs';
const summary=values=>({meanMs:values.reduce((a,b)=>a+b,0)/values.length,p95Ms:values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1]});
const results=[];
for(const density of [.15,1]){
  const definition={size:[256,80,256],position:[0,0,0],heightLimits:{min:-16,max:64},generator:{seed:123456},environment:{...AEGEAN_DEFAULTS,vegetationDensity:density}};
  const g=createVoxelGenerator(definition),chunks=[];
  for(let z=10;z<14;z++)for(let x=10;x<14;x++){const cell=[x,Math.floor(g.getTerrainHeight(x*32,z*32)/32),z];chunks.push({cell,data:g.generateChunk(...cell)});}
  const timings={reference:[],greedy:[]},totals={reference:{quads:0,bytes:0},greedy:{quads:0,bytes:0}};
  for(const {cell,data} of chunks){meshVoxelChunk(data,cell,g.getVoxel);meshGreedyVoxelChunk(data,cell,g.getVoxel);}
  for(let round=0;round<4;round++)for(const {cell,data} of chunks){
    const order=round%2?[['greedy',meshGreedyVoxelChunk],['reference',meshVoxelChunk]]:[['reference',meshVoxelChunk],['greedy',meshGreedyVoxelChunk]];
    for(const [name,mesh] of order){
      const start=performance.now(),result=mesh(data,cell,g.getVoxel);timings[name].push(performance.now()-start);
      if(round===0){totals[name].quads+=result.faceCount;totals[name].bytes+=(result.positions.length+result.normals.length+result.indices.length)*4;}
    }
  }
  results.push({density,chunks:chunks.length,samplesPerMesher:timings.greedy.length,reference:{...summary(timings.reference),...totals.reference},greedy:{...summary(timings.greedy),...totals.greedy}});
}
console.log(JSON.stringify({node:process.version,note:'Same process, identical chunks, warmed implementations, alternating order, four repetitions. Geometry bytes assume 32-bit indices.',results},null,2));

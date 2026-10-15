// Nodevision/scripts/aegean-benchmark.mjs
// This benchmark separates bounded Aegean chunk generation, meshing, analytic collision-style sampling and declarative serialization costs without claiming GPU frame rates.
import { createVoxelGenerator } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import { meshGreedyVoxelChunk as meshVoxelChunk } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelGreedyMesher.mjs';
import { AEGEAN_DEFAULTS } from '../ApplicationSystem/public/MetaWorld/Aegean/AegeanDefinition.mjs';
const results=[];
for(const density of [.15,1]){
  const def={id:'benchmark',type:'procedural-voxel-world',position:[0,0,0],size:[256,80,256],heightLimits:{min:-16,max:64},voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:123456},chunks:{voxelsPerAxis:32,loadRadius:2},environment:{...AEGEAN_DEFAULTS,vegetationDensity:density},generation:{vegetation:true,water:true,caves:true}};
  const g=createVoxelGenerator(def),generation=[],meshing=[];let faces=0,bytes=0;
  const startHeap=process.memoryUsage().heapUsed;
  for(let z=10;z<14;z++)for(let x=10;x<14;x++){
    const y=Math.floor(g.getTerrainHeight(x*32,z*32)/32),start=performance.now(),data=g.generateChunk(x,y,z),middle=performance.now(),mesh=meshVoxelChunk(data,[x,y,z],g.getVoxel);
    generation.push(middle-start);meshing.push(performance.now()-middle);faces+=mesh.faceCount;bytes+=(mesh.positions.length+mesh.normals.length+mesh.indices.length)*4;
  }
  const before=performance.now();for(let i=0;i<10000;i++)g.getVoxel(i%1024,70,(i*17)%1024);const sampleMs=performance.now()-before;
  const saveStart=performance.now(),json=JSON.stringify(def),saveMs=performance.now()-saveStart,loadStart=performance.now();createVoxelGenerator(JSON.parse(json));
  const stats=a=>({totalMs:a.reduce((x,y)=>x+y,0),meanMs:a.reduce((x,y)=>x+y,0)/a.length,p95Ms:a.slice().sort((x,y)=>x-y)[Math.ceil(a.length*.95)-1]});
  results.push({density,chunks:16,generation:stats(generation),meshing:stats(meshing),faces,estimatedGeometryBytes:bytes,sample10000Ms:sampleMs,featuresIn128mSquare:g.features.query([256,0,256],[768,320,768]).length,heapDeltaBytes:process.memoryUsage().heapUsed-startHeap,saveBytes:json.length,saveMs,loadMs:performance.now()-loadStart});
}
console.log(JSON.stringify({node:process.version,note:'CPU timings; main-thread chunk cost is not a rendered frame time. Heap delta includes temporary buffers and GC effects.',results},null,2));

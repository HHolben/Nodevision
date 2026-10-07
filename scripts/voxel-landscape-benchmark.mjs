// Nodevision/scripts/voxel-landscape-benchmark.mjs
// This benchmark isolates mountain height and broadleaf voxel sampling costs without building any persistent full-world feature inventory.
import { createVoxelGenerator } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import { mapleParameters,sampleMapleVoxel } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/MapleShape.mjs';
import { oakParameters,sampleOakVoxel } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/OakShape.mjs';
const generator=createVoxelGenerator({size:[1000,128,1000],generator:{seed:123456}}),report={};
let start=performance.now();for(let i=0;i<10000;i++)generator.getTerrainHeight((i*37)%4000,(i*71)%4000);report.heightQueries10000Ms=performance.now()-start;
for(const [species,parameters,sample] of [['Maple',mapleParameters,sampleMapleVoxel],['Oak',oakParameters,sampleOakVoxel]]){
  const p=parameters(123456);let occupied=0;start=performance.now();
  for(let y=0;y<p.height;y++)for(let z=-24;z<=24;z++)for(let x=-24;x<=24;x++)occupied+=sample(x,y,z,123456,p)!==0;
  report[species]={samples:p.height*49*49,occupied,samplingMs:performance.now()-start};
}
console.log(JSON.stringify(report));

// Nodevision/scripts/profile-terrain-e2-cpu.mjs
// Interleave original/current feature preparation on identical cached source descriptors. Separate voxel aggregation and coarse polygonal extraction from renderer/JIT frame scheduling; retain actual emitted boxes and triangles.
import fs from 'node:fs/promises';
import {createVoxelGenerator} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import {vegetationRegion,vegetationCells} from '../ApplicationSystem/public/MetaWorld/VegetationLOD/Sampling.mjs';
import {polygonalVegetationSteps} from '../ApplicationSystem/public/MetaWorld/VegetationLOD/Polygonal.mjs';
import {voxelTrunkBoxes} from '../ApplicationSystem/public/MetaWorld/VegetationLOD/Trunks.mjs';
import {mergeProxyBoxes} from '../ApplicationSystem/public/MetaWorld/VegetationLOD/Boxes.mjs';
import {drainSteps} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProgressiveTerrain.mjs';
const snapshot=JSON.parse(await fs.readFile(new URL('../docs/TerrainE2BaselineSources.json',import.meta.url),'utf8')),url=new URL('../ApplicationSystem/public/MetaWorld/VegetationLOD/Sampling.mjs',import.meta.url),code=snapshot.files['VegetationLOD/Sampling.mjs'].replace(/from '([^']+)'/g,(_,p)=>`from '${new URL(p,url)}'`),old=await import('data:text/javascript,'+encodeURIComponent(code));
const html=await fs.readFile(new URL('../Notebook/test.html',import.meta.url),'utf8'),geo=JSON.parse(html.match(/<script[^>]*id="nodevision-metaworld"[^>]*>([\s\S]*?)<\/script>/i)[1]).objects.find(o=>o.terrainSource==='geographic'),materials=Array.from({length:256},()=>({transparent:false,opacity:1})),results=[];
for(const source of ['procedural','infinite','geographic']){
 const def=source==='geographic'?geo:{position:[0,0,0],size:[1000,128,2000],generator:{seed:42},generation:{vegetation:true,water:false,caves:false},...(source==='infinite'?{worldExtent:{mode:'infinite'}}:{})},g=createVoxelGenerator(def);let anchor=source==='infinite'?-1:0;
 if(source==='geographic')for(let i=1;i<10;i++){const p=Math.min(def.size[0],def.size[2])*i/10;if(g.terrainSampler.sample(p,p).covered){anchor=Math.floor(p/32);break;}}
 const regions=[];if(source==='geographic'){for(let z=0;z<Math.ceil(def.size[2]/32)&&regions.length<4;z++)for(let x=0;x<Math.ceil(def.size[0]/32)&&regions.length<4;x++){const region=drainSteps(vegetationRegion(g,x,z));if(region.features.length)regions.push(region);}}else for(let z=0;z<2;z++)for(let x=0;x<2;x++)regions.push(drainSteps(vegetationRegion(g,anchor+x,anchor+z)));
 for(const mode of ['voxel','polygonal'])for(let trial=-1;trial<4;trial++)for(const variant of trial%2?['modified','baseline']:['baseline','modified']){
  const start=performance.now();let cells=0,boxes=0,triangles=0;
  for(const region of regions){const data=drainSteps((variant==='baseline'?old.vegetationCells:vegetationCells)(g,region,2));cells+=data.cells.length;
   if(mode==='polygonal'&&variant==='modified'){const p=drainSteps(polygonalVegetationSteps(data));triangles+=p.polygonal.reduce((n,s)=>n+s.result.indices.length/3,0);}
   else{const b=mergeProxyBoxes(variant==='modified'?voxelTrunkBoxes(data.cells):data.cells,data.step,materials);boxes+=b.length;triangles+=b.length*12;}
  }
  if(trial>=0)results.push({source,mode,trial,variant,preparationMs:performance.now()-start,cells,boxes,triangles,regions:regions.length,features:regions.reduce((n,r)=>n+r.features.length,0)});
 }
}
await fs.writeFile(new URL('../docs/TerrainE2CPU.json',import.meta.url),JSON.stringify({method:'Up to four cached real regions per source at LOD2 (geographic regions selected for existing vegetation), one discarded warmup per mode/variant then four alternating trials. Includes source-composed sampling, voxel box compaction or cooperative polygonal extraction; excludes GPU installation and rendering. Materials use opaque proxy merge eligibility; CPU timings are Node-specific.',results},null,2));console.log('PASS E2 CPU preparation trials',results.length);

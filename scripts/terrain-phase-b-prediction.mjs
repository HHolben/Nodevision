// Nodevision/scripts/terrain-phase-b-prediction.mjs
// This bounded acceleration trace compares prediction against reactive scheduling using real procedural generation and chunk meshes without GPU rendering. It measures complete column readiness before entering each column.
import fs from 'node:fs/promises';
import * as THREE from '../ApplicationSystem/public/lib/three/three.module.js';
import {createProceduralVoxelWorld} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {voxelMaterialOptions} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
const base={id:'terrain',size:[512,32,128],position:[0,0,0],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,water:false,caves:false}},rows=[];
for(const predictive of [false,true]){
 const root=createProceduralVoxelWorld(THREE,{...base,streaming:{predictive}},[],voxelMaterialOptions),runtime=root.userData.terrainRuntime;await runtime.ready;runtime.manager.options={...runtime.manager.options,budgetMs:1000,maxSteps:512};
 const point=new THREE.Vector3(24,20,32);let ready=0,entered=0,last=3;
 for(let frame=0;frame<400;frame++){
  point.x=frame<100?24:frame<250?32:32+(frame-250)*.5;const column=Math.floor(point.x/8);
  if(column!==last){entered++;if(runtime.manager.columnReady(column,4))ready++;last=column;}runtime.update(point);
 }
 rows.push({predictive,readyBeforeEntry:ready,enteredColumns:entered,stats:{...runtime.stats},lod:runtime.lod.snapshot()});runtime.dispose();
}
const result={trace:'400 update calls: x=24 for 100, x=32 for 150, then +0.5 m/update for 150; z=32. Real terrain, no rendering; 512 cooperative work units per update with a 1000 ms emergency time ceiling isolates scheduling from machine speed. Production uses the normal 4 ms deadline.',rows};
console.log(JSON.stringify(result,null,2));if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(result,null,2));

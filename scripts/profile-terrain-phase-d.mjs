// Nodevision/scripts/profile-terrain-phase-d.mjs
// Isolates settled coarse scheduling and mask cost from rendering using production geometry and a drained detailed manager.
import * as THREE from '../ApplicationSystem/public/lib/three/three.module.js';
import {createProceduralVoxelWorld} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {voxelMaterialOptions} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
import fs from 'node:fs/promises';
const results=[];
for(const size of [[50,50],[256,256],[1000,2000],[2000,2000],[4000,4000]]){
 const def={id:'profile',size:[size[0],64,size[1]],position:[0,0,0],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,caves:false,water:false}};
 const root=createProceduralVoxelWorld(THREE,def,[],voxelMaterialOptions),r=root.userData.terrainRuntime;await r.ready;
 const p=new THREE.Vector3(20,30,20);let checks=0;const column=r.manager.columnReady.bind(r.manager);r.manager.columnReady=(...a)=>{checks++;return column(...a);};
 const begin=performance.now();for(let i=0;i<10000;i++){r.lod.update(p);if(!r.lod.snapshot().queue)break;}
 const startupMs=performance.now()-begin,before=checks,t=performance.now();for(let i=0;i<1000;i++)r.lod.update(p);
 results.push({size,startupMs,settled1000Ms:performance.now()-t,columnChecks:checks-before,lod:r.lod.snapshot()});r.dispose();
}
const out=JSON.stringify(results,null,2);if(process.argv[2])await fs.writeFile(process.argv[2],out);else console.log(out);

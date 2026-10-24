// Nodevision/scripts/geographic-traversal-benchmark.mjs
// This benchmark uses real Express byte ranges and the real geographic runtime to measure a five-kilometer crop, compact save size, progressive mesh streaming, collision, vegetation and connected path grading during repeated traversal.
import express from 'express';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import * as THREE from '../ApplicationSystem/public/lib/three/three.module.js';
import { openRangeRaster } from '../ApplicationSystem/public/MetaWorld/Geographic/RangeSource.mjs';
import { importCrop,importLandcover } from '../ApplicationSystem/public/MetaWorld/Geographic/WindowImport.mjs';
import { geographicBounds,rectangle } from '../ApplicationSystem/public/MetaWorld/Geographic/CropGeometry.mjs';
import { finishRecipe } from '../ApplicationSystem/public/MetaWorld/Geographic/RecipeV2.mjs';
import { definitionFromVoxelForm,voxelWorldForm } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs';
import { createProceduralVoxelWorld } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import { voxelMaterialOptions } from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
import { validatePath } from '../ApplicationSystem/public/MetaWorld/Paths/PathDefinition.mjs';
import { samplePath,ribbonForPath } from '../ApplicationSystem/public/MetaWorld/Paths/PathGeometry.mjs';
const app=express();app.use('/Notebook',express.static(process.argv[2]||'/tmp/nodevision-geographic-large'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${server.address().port}`;
const original=globalThis.fetch;globalThis.fetch=(path,options)=>original(typeof path==='string'&&path.startsWith('/Notebook/')?url+path:path,options);
try{
  const memoryBefore=process.memoryUsage(),start=performance.now(),source=await openRangeRaster('/Notebook/large-dem.tif');
  const polygon=rectangle([673000,4355000,678000,4360000]),settings={crop:geographicBounds(polygon),regions:[{id:'square',name:'5 km square',biome:'',rings:polygon[0]}],boundary:'square',horizontalScale:1,verticalExaggeration:1,defaultBiome:'temperate'};
  const imported=await importCrop(source,settings),cover=await importLandcover(await openRangeRaster('/Notebook/large-cover.tif'),imported.plan,undefined,imported.elevation.samples.length*2),g=finishRecipe(imported,settings,cover.snapshot),importMs=performance.now()-start;
  assert.ok(g.size[0]>=5000&&g.size[2]>=5000);assert.ok(g.elevation.width<510);assert.ok(imported.access.transferredBytes<8*1024**2);
  const memoryAfterImport=process.memoryUsage(),def=definitionFromVoxelForm({...voxelWorldForm(),seed:'pelion-traversal',loadRadius:1,terrainSource:'geographic',geographic:g});def.position=[0,0,0];
  const root=createProceduralVoxelWorld(THREE,def,[],voxelMaterialOptions),runtime=root.userData.proceduralVoxelRuntime;await runtime.ready;
  const paths=[];for(const [i,startX] of [100,2500].entries()){
    const path=validatePath({id:'route-'+i,position:[0,0,0],controlPoints:[[startX,12,2500],[startX+2400,12,2500]],width:3,transitionWidth:1,interpolation:'straight',terrainInteraction:'grade',elevationMode:'authored'});
    paths.push(ribbonForPath(path,samplePath(THREE,path)));
  }
  runtime.setPathConstraints(paths);assert.equal(runtime.generator.getTerrainHeight(1000*4,2500*4),48);
  const locations=[[100,100],[4800,100],[4800,4800],[100,4800],[2500,2500]],frames=[],active=[],samples=[];let maxLoaded=0,maxResident=0,featureCount=0;
  for(let round=0;round<3;round++)for(const [x,z] of locations){
    const point=new THREE.Vector3(x,30,z);for(let frame=0;frame<90;frame++){
      const begin=performance.now();runtime.update(point);const elapsed=performance.now()-begin;active.push(elapsed);
      await new Promise(resolve=>setImmediate(resolve));frames.push(performance.now()-begin);maxLoaded=Math.max(maxLoaded,runtime.stats.loaded);maxResident=Math.max(maxResident,runtime.stats.residentBytes);
    }
    const height=root.userData.colliderRef.sampleGroundY(x,z);assert.ok(Number.isFinite(height));
    featureCount+=runtime.generator.features.query([x*4,0,z*4],[x*4+32,1024,z*4+32]).length;
    const caches=runtime.generator.cacheStats();assert.ok(caches.columns<=8192&&caches.features<=512&&caches.neighborhoods<=64&&caches.levels<=512&&caches.pathColumns<=8192&&caches.pathLookupTiles<=128);samples.push({round,x,z,height,loaded:runtime.stats.loaded,caches});
  }
  const measure=a=>({mean:a.reduce((n,v)=>n+v,0)/a.length,p95:a.slice().sort((a,b)=>a-b)[Math.floor(a.length*.95)],max:Math.max(...a)});
  const report={kind:'Node CPU benchmark; setImmediate intervals are not display/GPU frame times',worldMeters:g.size,sourcePixels:2048**2,cropSamples:g.elevation.width*g.elevation.height,importMs,
    access:imported.access,importPeakMemoryProxyBytes:Math.max(g.elevation.budget.peakBytes,g.landcover?.budget.peakBytes??0),memoryBefore,memoryAfterImport,memoryAfterTraversal:process.memoryUsage(),savedBytes:JSON.stringify(runtime.serialize()).length,
    updates:active.length,activeUpdateMs:measure(active),eventLoopIntervalMs:measure(frames),maxLoaded,maxResident,featureCount,stats:{...runtime.stats},traversal:samples};
  assert.ok(maxLoaded<=256&&maxResident<=128*1024**2);assert.ok(featureCount>0,'vegetation included');
  const badSource=await openRangeRaster('/Notebook/large-strip.tif');await assert.rejects(importCrop(badSource,settings),/strips\/tiles/);
  runtime.dispose();console.log(JSON.stringify(report,null,2));if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');
}finally{globalThis.fetch=original;await new Promise(resolve=>server.close(resolve));}

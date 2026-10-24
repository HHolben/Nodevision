// Nodevision/scripts/geographic-browser-benchmark.mjs
// This browser benchmark imports a five-kilometer terrain recipe and measures actual animation-frame intervals, rendering and bounded progressive streaming across distant locations with vegetation and graded routes.
import { ImportJobs } from '/MetaWorld/Geographic/ImportJobs.mjs';
import { rectangle,geographicBounds } from '/MetaWorld/Geographic/CropGeometry.mjs';
import { voxelWorldForm,definitionFromVoxelForm } from '/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs';
import { validatePath } from '/MetaWorld/Paths/PathDefinition.mjs';
import { samplePath,ribbonForPath } from '/MetaWorld/Paths/PathGeometry.mjs';
export async function geographicBrowserBenchmark({bridge,context,renderer,camera}) {
  const {THREE}=context,polygon=rectangle([673000,4355000,678000,4360000]),jobs=new ImportJobs(),start=performance.now();
  const g=await jobs.read({op:'prepare',path:'/Notebook/large-dem.tif',landcover:'/Notebook/large-cover.tif',settings:{crop:geographicBounds(polygon),regions:[{id:'square',name:'square',biome:'',rings:polygon[0]}],boundary:'square',horizontalScale:1,verticalExaggeration:1}}),importMs=performance.now()-start;
  const existing=context.objects.find(o=>o.userData.proceduralVoxelRuntime);if(existing)bridge.removeObjectLayer(existing.userData.metaWorldLayerId);
  const def=definitionFromVoxelForm({...voxelWorldForm(),terrainSource:'geographic',geographic:g,loadRadius:1,seed:'pelion-traversal'});def.position=[0,0,0];bridge.addVoxelWorld(def);
  const root=context.objects.find(o=>o.userData.proceduralVoxelRuntime),runtime=root.userData.proceduralVoxelRuntime;await runtime.ready;
  const pathStart=performance.now(),paths=[100,2500].map((x,i)=>{
    const d=validatePath({id:'benchmark-route-'+i,position:[0,0,0],controlPoints:[[x,12,2500],[x+2400,12,2500]],width:3,transitionWidth:1,interpolation:'straight',terrainInteraction:'grade',elevationMode:'authored'});
    return ribbonForPath(d,samplePath(THREE,d));
  });runtime.setPathConstraints(paths);const pathPrepareMs=performance.now()-pathStart;
  const frames=[],rafIntervals=[],updates=[],renders=[],visits=[];let previous=await new Promise(requestAnimationFrame),maxLoaded=0,maxMeshBytes=0,maxTriangles=0,wallPrevious=performance.now();
  for(let round=0;round<2;round++)for(const [x,z] of [[100,100],[4800,100],[4800,4800],[100,4800],[2500,2500]]){
    const point=new THREE.Vector3(x,30,z);camera.position.set(x+8,30,z+20);camera.lookAt(x,8,z);
    for(let frame=0;frame<45;frame++){
      const timestamp=await new Promise(requestAnimationFrame);rafIntervals.push(timestamp-previous);previous=timestamp;const wallNow=performance.now();frames.push(wallNow-wallPrevious);wallPrevious=wallNow;
      const begin=performance.now();runtime.update(point);updates.push(performance.now()-begin);const rendered=performance.now();renderer.render(context.scene,camera);renders.push(performance.now()-rendered);
      maxLoaded=Math.max(maxLoaded,runtime.stats.loaded);maxMeshBytes=Math.max(maxMeshBytes,runtime.stats.residentBytes);maxTriangles=Math.max(maxTriangles,renderer.info.render.triangles);
    }
    visits.push({round,x,z,loaded:runtime.stats.loaded,caches:runtime.generator.cacheStats(),ground:root.userData.colliderRef.sampleGroundY(x,z)});
  }
  const measure=a=>({mean:a.reduce((n,v)=>n+v,0)/a.length,p95:a.slice().sort((a,b)=>a-b)[Math.floor(a.length*.95)],max:Math.max(...a)});
  return {kind:'Headless Chromium / SwiftShader, real requestAnimationFrame; software rendering is not a hardware GPU guarantee',worldMeters:g.size,importMs,pathPrepareMs,frames:frames.length,
    frameIntervalMs:measure(frames),rafTimestampIntervalMs:measure(rafIntervals),streamingUpdateMs:measure(updates),renderSubmitMs:measure(renders),maxLoaded,maxMeshBytes,maxTriangles,savedBytes:JSON.stringify(runtime.serialize()).length,
    access:g.access,peakImportMemoryProxyBytes:Math.max(g.elevation.budget.peakBytes,g.landcover?.budget.peakBytes??0),stats:{...runtime.stats},visits};
}

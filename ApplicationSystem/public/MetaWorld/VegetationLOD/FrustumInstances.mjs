// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/FrustumInstances.mjs
// This optional instance-level visibility pass retains regional bounds and authoritative chunk ownership while omitting boxes wholly outside the active camera frustum. Matrix revisions avoid stationary scans, and conservative transformed spheres preserve every potentially visible box under translation, rotation and scale.
export function frustumInstances(THREE,mesh,pack,floor,step){
 const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),sphere=new THREE.Sphere(),previous=new Float64Array(48).fill(NaN);
 const stats={scans:0,bufferRewrites:0,culled:0};let source=[],selected=[],dirty=true;
 function record(matrix,offset){let changed=0;for(let i=0;i<16;i++){const v=matrix.elements[i];if(previous[offset+i]!==v)changed=1;previous[offset+i]=v;}return changed;}
 function prepare(camera,worldMatrix=mesh.matrixWorld){
  const material=mesh.material,safe=(material.isMeshStandardMaterial||material.isMeshBasicMaterial)&&!material.displacementMap&&(material.userData.vegetationDither===true||material.onBeforeCompile===THREE.Material.prototype.onBeforeCompile&&material.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey);
  if(!camera||camera.isArrayCamera||!mesh.frustumCulled||!safe){dirty=true;if(selected!==source){selected=source;stats.culled=0;stats.bufferRewrites++;pack(source);}return;}
  const changed=record(camera.projectionMatrix,0)|record(camera.matrixWorldInverse,16)|record(worldMatrix,32);
  if(!dirty&&!changed)return;dirty=false;stats.scans++;
  frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem);
  const visible=[];
  for(const c of source){const size=c.size||[step,step,step];sphere.center.set((c.p[0]+size[0]/2)*.25,(c.p[1]+size[1]/2)*.25+floor,(c.p[2]+size[2]/2)*.25);sphere.radius=Math.hypot(...size)*.125;sphere.applyMatrix4(worldMatrix);if(frustum.intersectsSphere(sphere))visible.push(c);}
  stats.culled=source.length-visible.length;
  if(visible.length===selected.length&&visible.every((c,i)=>c===selected[i]))return;
  selected=visible;stats.bufferRewrites++;pack(visible);
 };
 return {prepare,snapshot:()=>({...stats}),setCells(cells){source=cells;selected=cells;dirty=true;stats.bufferRewrites++;stats.culled=0;pack(cells);mesh.computeBoundingSphere();},dispose(){source=[];selected=[];}};
}

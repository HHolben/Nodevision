// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/FeatureCulling.mjs
// Conservative feature-envelope culling for batched polygonal proxies. Matrix revisions skip stationary scans; unchanged feature selections avoid index rewrites while authored/source bounds and signed coordinates stay authoritative.
export function featureCulling(THREE,features,floor,halo=0){
 const previous=new Float64Array(48).fill(NaN),projection=new THREE.Matrix4(),frustum=new THREE.Frustum(),sphere=new THREE.Sphere();let selected=null,scans=0;
 function changed(matrix,offset){let result=false;for(let i=0;i<16;i++){const v=matrix.elements[i];if(v!==previous[offset+i])result=true;previous[offset+i]=v;}return result;}
 return {snapshot:()=>({scans}),prepare(camera,matrix){
  if(!camera||camera.isArrayCamera){if(selected===null)return undefined;selected=null;return null;}
  const update=changed(camera.projectionMatrix,0)|changed(camera.matrixWorldInverse,16)|changed(matrix,32);if(!update)return undefined;scans++;
  frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem);const visible=new Set();
  for(const f of features){sphere.center.set(...f.min.map((v,a)=>(v+f.max[a])*.125+(a===1?floor:0)));sphere.radius=Math.hypot(...f.max.map((v,a)=>v-f.min[a]))*.125+Math.sqrt(3)*halo;sphere.applyMatrix4(matrix);if(frustum.intersectsSphere(sphere))visible.add(f.id);}
  if(selected&&visible.size===selected.size&&[...visible].every(id=>selected.has(id)))return undefined;selected=visible;return visible;
 }};
}

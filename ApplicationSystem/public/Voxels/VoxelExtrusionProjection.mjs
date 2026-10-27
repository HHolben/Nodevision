// Nodevision/ApplicationSystem/public/Voxels/VoxelExtrusionProjection.mjs
// Stable screen-space axis projection, integer distance snapping and exposed-face-biased automatic axis inference.
export function projectExtrusionAxes(THREE,viewport,center){
 const camera=viewport.camera,rect=viewport.renderer.domElement.getBoundingClientRect();camera.updateMatrixWorld(true);viewport.voxels.root.updateMatrixWorld(true);
 const origin=new THREE.Vector3(...center).applyMatrix4(viewport.voxels.root.matrixWorld);
 const screen=p=>{const v=p.project(camera);return [v.x*rect.width/2,-v.y*rect.height/2];},a=screen(origin.clone());
 const up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).multiplyScalar(viewport.voxels.root.scale.x),b=screen(origin.clone().add(up));
 const fallback=Math.max(4,Math.min(200,Math.hypot(b[0]-a[0],b[1]-a[1])||12));
 return 'xyz'.split('').map((axis,i)=>{const p=new THREE.Vector3(...center);p.setComponent(i,p.getComponent(i)+1);const b=screen(p.applyMatrix4(viewport.voxels.root.matrixWorld)),x=b[0]-a[0],y=b[1]-a[1],length=Math.hypot(x,y);
  return {axis,x:!Number.isFinite(length)||length<3?0:x,y:!Number.isFinite(length)||length<3?-fallback:y,fallback:!Number.isFinite(length)||length<3};});
}
export function extrusionDistance(vector,dx,dy){return Math.round((dx*vector.x+dy*vector.y)/(vector.x*vector.x+vector.y*vector.y));}
export function inferExtrusionAxis(vectors,dx,dy,exposure){
 if(Math.hypot(dx,dy)<6)return null;
 let best=null,score=-Infinity;vectors.forEach((v,i)=>{if(v.fallback)return;const dot=dx*v.x+dy*v.y,norm=Math.hypot(v.x,v.y)*Math.hypot(dx,dy),faces=exposure[i][dot<0?0:1],total=exposure[i][0]+exposure[i][1];const rank=Math.abs(dot)/norm+.03*faces/Math.max(1,total);if(rank>score){score=rank;best=v.axis;}});
 return best||'z';
}

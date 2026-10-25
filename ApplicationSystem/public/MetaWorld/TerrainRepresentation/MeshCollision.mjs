// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/MeshCollision.mjs
// Queries only explicitly owned active terrain meshes so polygonal ground and body contacts use the same triangles as rendering without touching imported colliders.
export function meshTerrainCollision(THREE,root,meshes,solid=()=>true){
  const ray=new THREE.Raycaster(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),triangle=new THREE.Triangle(a,b,c),box=new THREE.Box3();
  const ready=mesh=>{if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();return mesh.visible;};
  function sampleGroundY(x,z,maxY=Infinity){
    if(!root.visible)return NaN;root.updateMatrixWorld(true);let top=-Infinity;
    for(const mesh of meshes()){
      if(!ready(mesh))continue;const bounds=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      if(x<bounds.min.x||x>bounds.max.x||z<bounds.min.z||z>bounds.max.z)continue;
      ray.set(new THREE.Vector3(x,Number.isFinite(maxY)?maxY:bounds.max.y+1,z),new THREE.Vector3(0,-1,0));
      const hits=[];mesh.raycast(ray,hits);for(const hit of hits)if(solid(hit.face?.materialIndex??0))top=Math.max(top,hit.point.y);
    }return Number.isFinite(top)?top:NaN;
  }
  function intersectsPlayer(point,radius,minY,maxY,step=0){
    if(!root.visible)return false;root.updateMatrixWorld(true);box.min.set(point.x-radius,minY+step+.001,point.z-radius);box.max.set(point.x+radius,maxY,point.z+radius);if(box.min.y>=box.max.y)return false;
    for(const mesh of meshes()){
      if(!ready(mesh)||!box.intersectsBox(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)))continue;
      const g=mesh.geometry,p=g.attributes.position,index=g.index,groups=g.groups.length?g.groups:[{start:0,count:index.count,materialIndex:0}];
      for(const group of groups){if(!solid(group.materialIndex))continue;for(let i=group.start;i<group.start+group.count;i+=3){
        a.fromBufferAttribute(p,index.getX(i)).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,index.getX(i+1)).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,index.getX(i+2)).applyMatrix4(mesh.matrixWorld);
        if(box.intersectsTriangle(triangle))return true;
      }}
    }return false;
  }
  return {sampleGroundY,intersectsPlayer};
}

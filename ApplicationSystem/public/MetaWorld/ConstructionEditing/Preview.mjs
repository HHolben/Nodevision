// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionEditing/Preview.mjs
// Bounded transient cell batches visualize intentional excavation changes and geometry intersections without modifying terrain or construction assets.
export function cellPreview(THREE,parent,color){
 const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.35,depthWrite:false,wireframe:true});let mesh=null;
 return {update(points){if(!mesh||mesh.instanceMatrix.count<points.length){mesh?.removeFromParent();mesh?.dispose();mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,points.length));mesh.raycast=()=>{};parent.add(mesh);}const matrix=new THREE.Matrix4();mesh.count=points.length;points.forEach((p,i)=>mesh.setMatrixAt(i,matrix.makeTranslation(...p.map(n=>n+.5))));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();},dispose(){mesh?.removeFromParent();mesh?.dispose();geometry.dispose();material.dispose();}};
}
export function excavationPreview(edit,volumes,limit=16384){
 const points=[],seen=new Set(),original=edit.terrainVolumes;let visited=0,truncated=false;
 const proposed=volumes.filter(v=>v.active&&!original.some(o=>o.active&&v.position.every((n,i)=>n>=o.position[i]&&n+v.size[i]<=o.position[i]+o.size[i])));
 outer:for(const v of proposed)for(let x=v.position[0];x<v.position[0]+v.size[0];x++)for(let y=v.position[1];y<v.position[1]+v.size[1];y++)for(let z=v.position[2];z<v.position[2]+v.size[2];z++){
  if(++visited>limit){truncated=true;break outer;}const p=[x,y,z],key=p.join(',');if(seen.has(key))continue;seen.add(key);if(original.some(v=>v.active&&p.every((n,i)=>n>=v.position[i]&&n<v.position[i]+v.size[i])))continue;if(edit.terrainAt(p.map((n,i)=>edit.position[i]+(n+.5)*.25)))points.push(p);
 }return {points,truncated};
}

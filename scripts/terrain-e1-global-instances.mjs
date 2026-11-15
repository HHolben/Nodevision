// Nodevision/scripts/terrain-e1-global-instances.mjs
// This diagnostic builds a single compatible-material instance batch across visible resident vegetation regions. It intentionally tests the draw-call versus spatial-culling tradeoff without changing production ownership or residency.
import {colorBatches} from '/MetaWorld/Rendering/ColorBatches.mjs';
export function globalInstances(THREE,root){
 const original=[];root.updateMatrixWorld(true);root.traverseVisible(o=>{if(o.isInstancedMesh&&o.userData.vegetationProxy)original.push(o);});
 const materials=original.map(o=>o.material),palette=colorBatches(materials,materials.map((_,i)=>i)),buckets=new Map(),group=new THREE.Group(),matrix=new THREE.Matrix4(),inverse=root.matrixWorld.clone().invert(),color=new THREE.Color();
 original.forEach((mesh,i)=>{const batch=palette.mapping.get(i);if(!buckets.has(batch))buckets.set(batch,[]);buckets.get(batch).push(mesh);});
 for(const [batch,list] of buckets){const mesh=new THREE.InstancedMesh(list[0].geometry,batch.material,list.reduce((n,m)=>n+m.count,0));let at=0;
  for(const source of list)for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);matrix.premultiply(source.matrixWorld).premultiply(inverse);mesh.setMatrixAt(at,matrix);
   color.setRGB(1,1,1);if(source.instanceColor)source.getColorAt(i,color);if(batch.colored)color.multiply(source.material.color);mesh.setColorAt(at,color);at++;
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);
 }
 root.add(group);group.visible=false;
 return {set(enabled){group.visible=enabled;for(const mesh of original)mesh.visible=!enabled;},dispose(){for(const mesh of group.children)mesh.dispose();group.removeFromParent();palette.dispose();}};
}

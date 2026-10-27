// Nodevision/ApplicationSystem/public/Voxels/VoxelExtrusionOverlay.mjs
// Reuses the viewport overlay's geometry and root for pooled colored previews and a direction arrow without rebuilding document chunks.
import * as THREE from '/lib/three/three.module.js';
export class VoxelExtrusionOverlay {
 constructor(viewport){this.viewport=viewport;this.root=new THREE.Group();viewport.buildOverlay.root.add(this.root);this.geometry=viewport.buildOverlay.geometry;this.batches=new Map();this.arrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),1,0xffdd44);this.root.add(this.arrow);this.arrow.visible=false;this.onTheme=()=>{this.arrow.setColor(viewport.theme.cursor);this.batches.get('blocked')?.material.color.set(viewport.theme.blocked);viewport.render();};viewport.host.addEventListener('gox-viewport-theme',this.onTheme);this.onTheme();}
 batch(name,values,blocked=false){let entry=this.batches.get(name);const data=[...values];
  if(!entry||entry.mesh.instanceMatrix.count<data.length){if(entry){entry.mesh.dispose();entry.mesh.removeFromParent();entry.material.dispose();}const material=new THREE.MeshBasicMaterial({transparent:true,opacity:blocked?.3:.55,depthWrite:false,wireframe:blocked});const mesh=new THREE.InstancedMesh(this.geometry,material,Math.max(1,data.length*2));mesh.renderOrder=5;entry={mesh,material};this.batches.set(name,entry);this.root.add(mesh);}
  const matrix=new THREE.Matrix4(),color=new THREE.Color();entry.mesh.count=data.length;data.forEach((v,i)=>{entry.mesh.setMatrixAt(i,matrix.makeTranslation(...v.pos.map(n=>n+.5)));entry.mesh.setColorAt(i,blocked?color.set(0xffffff):color.setRGB(...v.color.slice(0,3).map(n=>n/255),THREE.SRGBColorSpace));});entry.mesh.instanceMatrix.needsUpdate=true;if(entry.mesh.instanceColor)entry.mesh.instanceColor.needsUpdate=true;entry.mesh.computeBoundingSphere();
 }
 update(plan){this.batch('new',plan.added.values());this.batch('blocked',plan.overlap.values(),true);
  this.arrow.visible=!!plan.steps;if(plan.steps){this.arrow.position.fromArray(plan.center);this.arrow.setDirection(new THREE.Vector3().setComponent('xyz'.indexOf(plan.axis),Math.sign(plan.steps)));this.arrow.setLength(Math.max(1,Math.abs(plan.steps)));}this.onTheme();this.viewport.buildOverlay.sync();
 }
 dispose(){this.viewport.host.removeEventListener('gox-viewport-theme',this.onTheme);for(const {mesh,material} of this.batches.values()){mesh.dispose();material.dispose();}if(this.arrow)this.arrow.traverse(o=>{o.material?.dispose();});this.root.removeFromParent();this.viewport.render();}
}

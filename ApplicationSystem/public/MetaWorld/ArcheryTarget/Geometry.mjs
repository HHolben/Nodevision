// Shared, reference-counted vertex-colored geometry: one opaque draw per target, independent of five scoring regions.
const pools=new WeakMap();
export function targetGeometry(THREE,def){
 let pool=pools.get(THREE);if(!pool)pools.set(THREE,pool=new Map());const key=JSON.stringify([def.diameter,def.faceHeight,def.thickness,def.showStand,def.rings.map(r=>[r.radius,r.color])]);let lease=pool.get(key);
 if(!lease){const parts=[],radius=def.diameter/2;
  const add=(g,color,matrix)=>{if(matrix)g.applyMatrix4(matrix);const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();const c=new THREE.Color(color),colors=new Float32Array(flat.attributes.position.count*3);for(let i=0;i<colors.length;i+=3)c.toArray(colors,i);flat.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(flat);};
  const matrix=(position,rotation=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1))=>new THREE.Matrix4().compose(position,rotation,scale);
  add(new THREE.CylinderGeometry(radius,radius,def.thickness,40), '#90734f',matrix(new THREE.Vector3(0,def.faceHeight,0),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)));
  let inner=0;for(const ring of def.rings){add(new THREE.RingGeometry(inner*radius,ring.radius*radius,40),ring.color,matrix(new THREE.Vector3(0,def.faceHeight,def.thickness/2+.001)));inner=ring.radius;}
  const standStart=parts.reduce((n,p)=>n+p.attributes.position.count,0);
  if(def.showStand){for(const foot of [[-radius*.7,0,.3],[radius*.7,0,.3],[0,0,-.55]]){const a=new THREE.Vector3(...foot),b=new THREE.Vector3(0,def.faceHeight+.1,-def.thickness/2-.04),delta=b.clone().sub(a);add(new THREE.CylinderGeometry(.035,.045,delta.length(),6),'#775233',matrix(a.add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())));}}
  const geometry=new THREE.BufferGeometry();for(const name of ['position','normal','color']){const data=new Float32Array(parts.reduce((n,p)=>n+p.attributes[name].array.length,0));let offset=0;for(const p of parts){data.set(p.attributes[name].array,offset);offset+=p.attributes[name].array.length;}geometry.setAttribute(name,new THREE.BufferAttribute(data,3));}for(const g of parts)g.dispose();geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85});lease={geometry,material,standStart,refs:0};pool.set(key,lease);
 }
 lease.refs++;let released=false;return {...lease,release(){if(released)return;released=true;if(!--lease.refs){lease.geometry.dispose();lease.material.dispose();pool.delete(key);}}};
}

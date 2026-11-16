// Fixed-capacity transient GPU buffers: one instanced arrow draw, one dotted Points draw, and a lightweight animated first-person bow.
export function createArcheryVisuals(THREE,scene){
 const group=new THREE.Group();group.name='Archery session';group.userData={noninteractive:true,excludeFromRaycast:true};scene.add(group);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.018,0,.65,.018,0,.65,0,.012,.62],3));geometry.setIndex([0,1,2,0,3,1,0,2,3,1,3,2]);geometry.computeVertexNormals();
 const material=new THREE.MeshBasicMaterial({color:0xe9c979,side:THREE.DoubleSide});const arrows=new THREE.InstancedMesh(geometry,material,80);arrows.count=0;arrows.frustumCulled=false;group.add(arrows);
 const traceGeometry=new THREE.BufferGeometry(),tracePositions=new Float32Array(96*3);traceGeometry.setAttribute('position',new THREE.BufferAttribute(tracePositions,3));traceGeometry.setDrawRange(0,0);
 const traceMaterial=new THREE.PointsMaterial({color:0x8ee4dc,size:3.5,sizeAttenuation:false,depthWrite:false});traceMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() { if(length(gl_PointCoord - vec2(0.5)) > 0.5) discard;');};traceMaterial.customProgramCacheKey=()=>"nv-archery-round-dots-v1";const trace=new THREE.Points(traceGeometry,traceMaterial);trace.frustumCulled=false;trace.visible=false;group.add(trace);
 const bow=new THREE.Group();group.add(bow);bow.visible=false;
 const limbGeometry=new THREE.BoxGeometry(.025,.085,.025),limbMaterial=new THREE.MeshBasicMaterial({color:0x9c693b,depthTest:false,depthWrite:false});const limbs=new THREE.InstancedMesh(limbGeometry,limbMaterial,16);limbs.frustumCulled=false;limbs.renderOrder=1001;bow.add(limbs);
 const stringGeometry=new THREE.BufferGeometry();stringGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3));const stringMaterial=new THREE.LineBasicMaterial({color:0xe6dfc9,depthTest:false,depthWrite:false});const string=new THREE.Line(stringGeometry,stringMaterial);string.renderOrder=1002;bow.add(string);
 const nockMaterial=material.clone();nockMaterial.depthTest=false;nockMaterial.depthWrite=false;const nock=new THREE.Mesh(geometry,nockMaterial);nock.renderOrder=1003;bow.add(nock);
 const dummy=new THREE.Object3D(),direction=new THREE.Vector3(),axis=new THREE.Vector3(0,0,-1),point=new THREE.Vector3(),quaternion=new THREE.Quaternion();
 function arrowPose(p,v){dummy.position.fromArray(p);direction.fromArray(v);if(direction.lengthSq()>1e-12)dummy.quaternion.setFromUnitVectors(axis,direction.normalize());dummy.scale.set(1,1,1);dummy.updateMatrix();return dummy.matrix;}
 function updateArrows(records){arrows.count=records.length;records.forEach((r,i)=>{arrows.setMatrixAt(i,arrowPose(r.state.p,r.state.v));});arrows.instanceMatrix.needsUpdate=true;}
 let viewCamera=null;
 function updateBow(camera,u,drawing,hand){
  viewCamera=camera;
  bow.visible=true;camera.updateWorldMatrix(true,false);camera.getWorldQuaternion(quaternion);bow.quaternion.copy(quaternion);bow.position.set(hand==='off'?-.29:.29,-.23,-.65).applyMatrix4(camera.matrixWorld);
  const curve=t=>new THREE.Vector3(0,t*.55,-.14*(1-t*t)+u*.12*Math.abs(t));
  for(let i=0;i<16;i++){const a=curve(-1+i/8),b=curve(-1+(i+1)/8);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());dummy.scale.set(1,a.distanceTo(b)/.085,1);dummy.updateMatrix();limbs.setMatrixAt(i,dummy.matrix);}limbs.instanceMatrix.needsUpdate=true;
  const top=curve(1),bottom=curve(-1),center=new THREE.Vector3(0,0,.05+u*.28);[top,center,bottom].forEach((p,i)=>p.toArray(stringGeometry.attributes.position.array,i*3));stringGeometry.attributes.position.needsUpdate=true;
  nock.visible=drawing;nock.position.set(0,0,center.z-.65);nock.quaternion.identity();bow.userData.drawFraction=u;bow.userData.stringDisplacement=u*.28;
 }
 function updateTrace(states,hit){
  let count=0,last=null,lastScreen=null;const spacing=Math.max(.8,(states.at(-1)?.distance||0)/95),projected=new THREE.Vector3();
  for(const state of states){
   if(state.distance-states[0].distance<1||last&&Math.hypot(...state.p.map((n,i)=>n-last[i]))<spacing)continue;
   if(viewCamera){projected.fromArray(state.p).project(viewCamera);if(projected.z< -1||projected.z>1||Math.abs(projected.x)>1.1||Math.abs(projected.y)>1.1)continue;if(lastScreen&&Math.hypot(projected.x-lastScreen[0],projected.y-lastScreen[1])<.022)continue;lastScreen=[projected.x,projected.y];}
   tracePositions.set(state.p,count++*3);last=state.p;if(count===96)break;
  }
  traceGeometry.setDrawRange(0,count);traceGeometry.attributes.position.needsUpdate=true;trace.visible=count>0;traceMaterial.color.set(hit&&!hit.uncertain?0x8ee4dc:0xc1b58b);trace.userData.verified=!!hit&&!hit.uncertain;return count;
 }
 function dispose(){group.removeFromParent();for(const g of [geometry,traceGeometry,limbGeometry,stringGeometry])g.dispose();for(const m of [material,traceMaterial,limbMaterial,stringMaterial,nockMaterial])m.dispose();arrows.dispose();limbs.dispose();}
 return {group,bow,trace,arrows,updateArrows,updateBow,updateTrace,dispose,hide(){bow.visible=false;trace.visible=false;},bytes:arrows.instanceMatrix.array.byteLength+limbs.instanceMatrix.array.byteLength+[geometry,traceGeometry,limbGeometry,stringGeometry].reduce((n,g)=>n+Object.values(g.attributes).reduce((v,a)=>v+a.array.byteLength,0)+(g.index?.array.byteLength||0),0)};
}

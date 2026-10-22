// Nodevision/ApplicationSystem/public/Voxels/VoxelViewport.mjs
// GOX viewport reusing Nodevision Three.js, OrbitControls and the shared orientation widget.
import * as THREE from '/lib/three/three.module.js';
import { OrbitControls } from '/lib/three/OrbitControls.js';
import { ViewportOrientationWidget } from '/Widgets/ViewportOrientationWidget.mjs';
import { VoxelScene } from './VoxelScene.mjs';
import { brushPoints } from './VoxelBrush.mjs';
import { VoxelBuildOverlay } from './VoxelBuildOverlay.mjs';
import { point } from './VoxelModel.mjs';
export class VoxelViewport {
  constructor(host){
    this.host=host;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#202833');this.voxels=new VoxelScene();this.scene.add(this.voxels.root);
    this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(45,1,0.01,10000000);this.camera.up.set(0,0,1);this.camera.position.set(30,-40,30);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,RIGHT:THREE.MOUSE.PAN};this.controls.addEventListener('change',()=>this.render());
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x666666,2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(30,-20,50);this.scene.add(light);
    this.grid=new THREE.GridHelper(64,64);this.grid.rotation.x=Math.PI/2;this.scene.add(this.grid,new THREE.AxesHelper(10));
    this.preview=new THREE.Box3Helper(new THREE.Box3(),0xffff00);this.preview.visible=false;this.scene.add(this.preview);
    this.selection=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0x00ffff,size:5,sizeAttenuation:false,depthTest:false}));this.selection.renderOrder=10;this.scene.add(this.selection);
    this.widget=new ViewportOrientationWidget({container:host,THREE,camera:this.camera,controls:this.controls,viewAdapter:{getCamera:()=>this.camera,getControls:()=>this.controls,requestRender:()=>{this.render();return true;}}});this.widget.mount();
    this.buildOverlay=new VoxelBuildOverlay(this);this.workplane={plane:'xz',height:0};
    this.resize=new ResizeObserver(()=>this.measure());this.resize.observe(host);this.measure();
  }
  measure(){const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight);this.renderer.setSize(w,h);if(this.camera.isPerspectiveCamera)this.camera.aspect=w/h;else{this.camera.left=-this.span*w/h;this.camera.right=this.span*w/h;this.camera.top=this.span;this.camera.bottom=-this.span;}this.camera.updateProjectionMatrix();this.render();}
  render(){if(this.closed||this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;if(this.closed)return;this.renderer.render(this.scene,this.camera);this.widget?.sync();});}
  update(model,selection=new Set(),layer=0){this.voxels.update(model);const coords=[];for(const k of selection){if(coords.length>=300000)break;coords.push(...point(k).map(v=>v+0.5));}this.selection.geometry.dispose();this.selection.geometry=new THREE.BufferGeometry();this.selection.geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));this.selection.scale.copy(this.voxels.root.scale);this.selection.visible=!!model.layers[layer]?.visible;this.render();}
  frameModel(selection=false){const box=selection&&this.selection.geometry.attributes.position.count?new THREE.Box3().setFromObject(this.selection):new THREE.Box3().setFromObject(this.voxels.root);if(box.isEmpty())box.set(new THREE.Vector3(-8,-8,0),new THREE.Vector3(8,8,16));const center=box.getCenter(new THREE.Vector3()),size=Math.max(4,box.getSize(new THREE.Vector3()).length());const direction=this.camera.position.clone().sub(this.controls.target).normalize();this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,size*1.5);this.span=size/2;this.controls.update();this.measure();}
  projection(orthographic){const old=this.camera;this.span=Math.max(2,old.position.distanceTo(this.controls.target)/2);this.camera=orthographic?new THREE.OrthographicCamera(-this.span,this.span,this.span,-this.span,0.01,10000000):new THREE.PerspectiveCamera(45,1,0.01,10000000);this.camera.position.copy(old.position);this.camera.up.copy(old.up);this.controls.object=this.camera;this.controls.update();this.measure();}
  view(direction){const distance=this.camera.position.distanceTo(this.controls.target);this.camera.position.copy(this.controls.target).add(new THREE.Vector3(...direction).normalize().multiplyScalar(distance));this.controls.update();this.render();}
  hit(event,add=false){const r=this.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),this.camera);const hits=ray.intersectObject(this.voxels.root,true).filter(h=>h.object.parent?.parent?.visible);if(hits.length){const hit=hits[0],p=hit.object.worldToLocal(hit.point.clone()).addScaledVector(hit.face.normal,add?0.001:-0.001);return{at:p.toArray().map(Math.floor),layer:hit.object.userData.layerIndex};}const axis={xy:2,xz:1,yz:0}[this.workplane.plane],normal=new THREE.Vector3().setComponent(axis,1),p=ray.ray.intersectPlane(new THREE.Plane(normal,-this.workplane.height*this.voxels.root.scale.x),new THREE.Vector3());if(p)this.voxels.root.worldToLocal(p);if(!p)return null;const at=p.toArray().map(Math.floor);at[axis]=this.workplane.height;return{at};}

  cursor(at,brush){this.preview.scale.copy(this.voxels.root.scale);this.preview.visible=!!at;if(at){const points=brushPoints(at,brush);this.preview.box.makeEmpty();for(const p of points){this.preview.box.expandByPoint(new THREE.Vector3(...p));this.preview.box.expandByPoint(new THREE.Vector3(...p.map(v=>v+1)));}}this.render();}
  dispose(){this.closed=true;this.buildOverlay.dispose();cancelAnimationFrame(this.frame);this.resize.disconnect();this.widget.destroy();this.controls.dispose();this.voxels.dispose();this.scene.traverse(o=>{o.geometry?.dispose();if(o.material&&!this.voxels.materials.includes(o.material))o.material.dispose?.();});this.renderer.dispose();this.renderer.domElement.remove();}
}

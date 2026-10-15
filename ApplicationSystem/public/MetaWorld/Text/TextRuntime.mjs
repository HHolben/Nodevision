// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextRuntime.mjs
// This module owns disposable text rendering and sign structures while serializing only source definitions and exact local transforms.

import {normalizeText,textVisible,textRenderKey} from './TextDefinition.mjs';
import {loadTextFont} from './TextLayout.mjs';
import {acquireTextTexture} from './TextTextureCache.mjs';
import {reliefGeometry} from './TextRelief.mjs';
import {textMaterialInfo,acquireTextSurfaceMaterial,releaseTextSurfaceMaterial} from './TextMaterialCache.mjs';
export function createTextObject(THREE,source) {
 let def=normalizeText(source),disposed=false,generation=0,textureLease=null,renderKey='';
 const root=new THREE.Mesh(new THREE.PlaneGeometry(def.width,def.height),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));
 const visual=new THREE.Group();root.add(visual);
 const clear=()=>{for(const child of [...visual.children]){child.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean)){if(m.map&&m.map!==textureLease?.texture)m.map.dispose();if(!releaseTextSurfaceMaterial(m))m.dispose();}});visual.remove(child);}textureLease?.release();textureLease=null;};
 function material(id,color,token,catalogColor=false) {
  if(catalogColor)return acquireTextSurfaceMaterial(THREE,id,color,def);
  const m=new THREE.MeshStandardMaterial({color,roughness:def.roughness,metalness:def.metalness,transparent:def.opacity<1,opacity:def.opacity,side:THREE.DoubleSide});
  if(id)textMaterialInfo(id).then(info=>{if(disposed||token!==generation)return;const r=info.rendering;if(def.materialProperties){m.roughness=r.roughness??def.roughness;m.metalness=r.metalness??def.metalness;}}).catch(()=>{});
  return m;
 }
 function box(w,h,d,x,y,z,id,color,token){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(id,color,token,true));mesh.position.set(x,y,z);visual.add(mesh);return mesh;}
 function draw(family,token) {
  if(disposed||token!==generation)return;clear();
  textureLease=acquireTextTexture(THREE,def,family);const {canvas,texture}=textureLease;
  const m=material(def.material,def.color,token);m.map=texture;m.transparent=true;m.alphaTest=.05;m.depthWrite=true;m.forceSinglePass=true;
  if(def.emissive){m.emissive.set(def.emissive);m.emissiveIntensity=1;}
  let z=def.surfaceOffset;
  if(def.kind==='sign') {
   box(def.width+.15,def.height+.15,def.thickness,0,0,-def.thickness/2,def.surfaceMaterial,'#927044',token);
   if(def.signPreset==='directional-arrow') {
    const shape=new THREE.Shape();shape.moveTo(0,-def.height/2);shape.lineTo(def.height*.5,0);shape.lineTo(0,def.height/2);shape.closePath();
    const arrow=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:def.thickness,bevelEnabled:false}),material(def.surfaceMaterial,'#927044',token,true));arrow.position.set(def.width/2,0,-def.thickness);visual.add(arrow);
   }
   if(def.support)box(.12,1.2,def.thickness,0,-def.height/2-.5,-def.thickness,def.frameMaterial,'#705031',token);
   if(def.frame){for(const y of [-1,1])box(def.width+.25,.07,def.thickness+.04,0,y*(def.height/2+.07),-def.thickness/2,def.frameMaterial,'#705031',token);for(const x of [-1,1])box(.07,def.height+.15,def.thickness+.04,x*(def.width/2+.09),0,-def.thickness/2,def.frameMaterial,'#705031',token);}
   if(def.signPreset==='stone-stele')box(def.width+.3,.25,def.thickness*2,0,-def.height/2-.2,-def.thickness/2,def.surfaceMaterial,'#aaaa99',token);
  }
  if(def.background)box(def.width,def.height,.002,0,0,z-.002,'',def.background,token);
  if(def.kind==='raised'||def.kind==='free-standing'&&def.depth>0) {
   const relief=new THREE.Mesh(reliefGeometry(THREE,canvas,def),material(def.sideMaterial,def.color,token));relief.position.z=z;visual.add(relief);z+=def.depth;
  }
  if(def.kind==='engraved') {
   // Offset highlights and a dark glyph mask simulate shallow grooves without touching the parent.
   const highlight=m.clone();highlight.color.set('#ddd6c8');highlight.map=texture.clone();highlight.map.needsUpdate=true;
   const edge=new THREE.Mesh(new THREE.PlaneGeometry(def.width,def.height),highlight);edge.position.set(def.engravingDepth*.25+def.bevel,-def.engravingDepth*.25-def.bevel,z);visual.add(edge);z+=.001;
   m.color.multiplyScalar(1-.7*Math.min(1,def.engravingDepth*10));m.roughness=Math.min(1,def.roughness+def.weathering*.2);
  }
  const face=new THREE.Mesh(new THREE.PlaneGeometry(def.width,def.height),m);face.position.z=z;visual.add(face);
  visual.traverse(o=>{o.userData.runtimeGenerated=true;o.userData.textRoot=root;});
 }
 function update(source) {
  def=normalizeText(source);root.position.fromArray(def.position);root.rotation.set(...def.rotation);root.scale.fromArray(def.scale);root.visible=def.visible;
  const nextKey=textRenderKey(def);if(nextKey===renderKey)return;renderKey=nextKey;
  if(root.geometry.parameters.width!==def.width||root.geometry.parameters.height!==def.height){root.geometry.dispose();root.geometry=new THREE.PlaneGeometry(def.width,def.height);}
  const token=++generation;draw(def.font,token);
  runtime.ready=loadTextFont(def).then(font=>{if(disposed||token!==generation)return;if(def.fontUrl)draw(font,token);runtime.fontWarning='';}).catch(async error=>{if(disposed||token!==generation)return;runtime.fontWarning=error.message;try{const fallback=await loadTextFont({...def,fontUrl:'/fonts/dejavu/DejaVuSerif.ttf'});draw(fallback,token);}catch{ /* Browser serif remains usable offline if the bundled font is unavailable. */ }});
 }
 const runtime={serialize:()=>({...structuredClone(def),position:root.position.toArray(),rotation:root.rotation.toArray().slice(0,3),scale:root.scale.toArray(),visible:def.visible}),update,
  setAuthoredVisibility(value){delete def.hidden;def.visible=value;root.visible=value;},
  setDisplayState(state){root.visible=textVisible(def,state);root.material.visible=false;},
  dispose(){if(disposed)return;disposed=true;generation++;clear();root.geometry.dispose();root.material.dispose();root.removeFromParent();}};
 Object.assign(root.userData,{nvType:'world-text',metaWorldLayerId:def.id,textRuntime:runtime,breakable:true,placedByPlayer:true,isSolid:false});update(def);return root;
}

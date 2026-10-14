// Nodevision/ApplicationSystem/public/Modeling/ModelAssets.mjs
// This module exports the existing Three.js scene with the matching glTF exporter and reuses Nodevision's Notebook save API and material catalog. Failed texture loads leave the existing appearance intact.
import * as T from '../lib/three/three.module.js';
import { GLTFExporter } from '../lib/three/examples/jsm/exporters/GLTFExporter.js';
import { resolveWorldObjectMaterial } from '../MetaWorld/Materials/WorldObjectMaterialResolver.mjs';
import { saveViaApi,notifyFileSaved } from '../ToolbarCallbacks/file/saveFile/utils.mjs';
export async function exportModel(root,animations=[],binary=true) {
  if(!root)throw new Error('No model to save');
  const hidden=[],helpers=[];
  root.traverse(n=>{if(n.userData.nvBoneDisplay)helpers.push({node:n,parent:n.parent});if(!n.visible){hidden.push([n,n.userData.nvHidden]);n.userData.nvHidden=true;}});
  helpers.forEach(({node})=>node.removeFromParent());
  try {return await new GLTFExporter().parseAsync(root,{binary,onlyVisible:false,animations,trs:true});}
  finally {helpers.forEach(({node,parent})=>parent.add(node));hidden.forEach(([n,old])=>{if(old===undefined)delete n.userData.nvHidden;else n.userData.nvHidden=old;});}
}
export async function saveModel(root,animations,path) {
  if(!/\.(gltf|glb)$/i.test(path||''))throw new Error('Choose a Notebook path ending in .gltf or .glb');
  const binary=/\.glb$/i.test(path),result=await exportModel(root,animations,binary);
  let content;if(binary){const bytes=new Uint8Array(result);let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));content=btoa(text);}else content=JSON.stringify(result,null,2);
  await saveViaApi({path,content,encoding:binary?'base64':'utf8',mimeType:binary?'model/gltf-binary':'model/gltf+json'});notifyFileSaved(path);return true;
}
export async function materialChanges(args) {
  if(args.catalog){const resolved=await resolveWorldObjectMaterial(args.catalog);const r=resolved.rendering;return{color:r.color,metalness:r.metalness??r.metallic??0,roughness:r.roughness??.65,opacity:r.opacity??1,catalog:resolved.materialId};}
  const result={...args};
  for(const key of ['metalness','roughness','opacity'])if(key in result){const v=Number(result[key]);if(!Number.isFinite(v)||v<0||v>1)throw new Error(key+' must be between 0 and 1');result[key]=v;}
  if(result.color&&!/^#[\da-f]{6}$/i.test(result.color))throw new Error('Use a six-digit hex color');
  if(result.texture){if(!/^\/Notebook\//.test(result.texture))throw new Error('Choose a texture under /Notebook/');result.map=await new T.TextureLoader().loadAsync(result.texture);result.map.colorSpace=T.SRGBColorSpace;result.map.flipY=false;}
  for(const key of ['repeat','offset'])if(result[key]&&(!Array.isArray(result[key])||result[key].length!==2||result[key].some(v=>!Number.isFinite(Number(v)))))throw new Error(key+' requires two finite numbers');
  if(result.rotation!==undefined&&!Number.isFinite(Number(result.rotation)))throw new Error('Texture rotation must be finite');return result;
}
export function applyMaterial(objects,values) {
  const seen=new Set();for(const object of objects)object.traverse(n=>{
    if(!n.material||seen.has(n))return;seen.add(n);
    n.material=[].concat(n.material).map(old=>{const material=old.clone();if(values.color)material.color?.set(values.color);for(const key of ['metalness','roughness','opacity'])if(key in values&&key in material)material[key]=values[key];if('opacity' in values)material.transparent=values.opacity<1;
      if(values.map)material.map=values.map;
      if(material.map&&(values.repeat||values.offset||values.rotation!==undefined)){material.map=material.map.clone();if(values.repeat){material.map.repeat.fromArray(values.repeat);material.map.wrapS=material.map.wrapT=T.RepeatWrapping;}if(values.offset)material.map.offset.fromArray(values.offset);if(values.rotation!==undefined)material.map.rotation=T.MathUtils.degToRad(values.rotation);material.map.needsUpdate=true;}
      if(values.catalog)material.userData.nvMaterialId=values.catalog;material.needsUpdate=true;return material;});
    if(n.material.length===1)n.material=n.material[0];
  });
}

// Nodevision/ApplicationSystem/public/MetaWorld/SessionVoxels/SessionPalette.mjs
// Stable transient material indices exist before async material loading, including during spawn and collision queries.
import {VOXEL_MATERIAL_IDS,isLiquidVoxel} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
export function createSessionPalette(THREE){
 const values=new Map(),signatures=new Map();let palette=null;
 function material(value){
  if(value.paletteIndex>0&&VOXEL_MATERIAL_IDS[value.paletteIndex]===value.materialId&&!value.customColor)return value.paletteIndex;
  const signature=JSON.stringify(value);let i=signatures.get(signature);if(i===undefined){if(values.size>=3840)throw Error('Temporary material palette limit reached');i=256+values.size;signatures.set(signature,i);values.set(i,value);}
  if(palette&&!palette.entries[i]){
   while(palette.entries.length<=i){palette.entries.push(null);palette.materials.push(palette.materials[2]);}
   const color=new THREE.Color().setRGB(...value.rgba.slice(0,3).map(n=>n/255),THREE.SRGBColorSpace);
   palette.materials[i-1]=new THREE.MeshStandardMaterial({color,opacity:value.rgba[3]/255,transparent:value.rgba[3]<255,depthWrite:value.rgba[3]===255,roughness:.8});
   palette.entries[i]={sessionSignature:signature,...value,physicsMaterialId:value.materialId,collider:{solid:value.solid},matterState:value.matterState||'solid'};
  }return i;
 }
 return {material,solid:i=>palette?.entries[i]?.collider?.solid??values.get(i)?.solid??(!!i&&!isLiquidVoxel(i)),attach(value){palette=value;for(const v of values.values())material(v);},dispose(){values.clear();signatures.clear();palette=null;}};
}

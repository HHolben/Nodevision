// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextTextureCache.mjs
// This module shares shaped canvas textures between identical live inscriptions and releases GPU storage when the final owner is disposed.
import {textCanvas} from './TextLayout.mjs';
const textures=new Map();
export function acquireTextTexture(THREE,def,family) {
 const key=JSON.stringify([def.content,def.width,def.height,def.fontSize,def.lineSpacing,def.letterSpacing,def.alignment,def.weathering,family]);
 let entry=textures.get(key);
 if(!entry){const canvas=textCanvas(def,family),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;entry={canvas,texture,users:0};textures.set(key,entry);}
 entry.users++;let released=false;
 return {...entry,release(){if(released)return;released=true;if(--entry.users===0){entry.texture.dispose();textures.delete(key);}}};
}
export const textTextureCacheSize=()=>textures.size;

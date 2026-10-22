// Nodevision/ApplicationSystem/public/Voxels/GoxMaterials.mjs
// Reads and edits documented GOX material dictionaries without inventing physical material identities.
import {dictionary,writeDictionary,text,utf8} from './Binary.mjs';
const dimensions={color:4,metallic:1,roughness:1,emission:3};
const defaults={name:'Material',color:[1,1,1,1],metallic:0.2,roughness:0.5,emission:[0,0,0]};
export function readMaterial(payload){const fields=payload?dictionary(payload):new Map(),result={...defaults};for(const [name,size] of Object.entries(dimensions)){const bytes=fields.get(name);if(!bytes)continue;if(bytes.length!==size*4)throw Error('Invalid GOX material '+name);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.length),values=Array.from({length:size},(_,i)=>view.getFloat32(i*4,true));if(values.some(v=>!Number.isFinite(v)))throw Error('Invalid material value');result[name]=size===1?values[0]:values;}if(fields.has('name'))result.name=text.decode(fields.get('name'));return result;}
export function editMaterial(model,index,changes){
 const materials=model.extras.filter(e=>e.type==='MATE');if(!Number.isInteger(index)||index<0||index>materials.length)throw Error('Invalid material index');const old=materials[index],fields=old?dictionary(old.payload):new Map(),values={...readMaterial(old?.payload),...changes};
 for(const [name,size] of Object.entries(dimensions)){const input=size===1?[values[name]]:values[name];if(!Array.isArray(input)||input.length!==size||input.some(v=>!Number.isFinite(v)||v<0||(name!=='emission'&&v>1)||v>100))throw Error('Invalid material '+name);const bytes=new Uint8Array(size*4),view=new DataView(bytes.buffer);input.forEach((v,i)=>view.setFloat32(i*4,v,true));fields.set(name,bytes);}fields.set('name',utf8(String(values.name)));const entry={type:'MATE',payload:writeDictionary(fields)};if(old)model.extras[model.extras.indexOf(old)]=entry;else model.extras.push(entry);
}

// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.mjs
// This module performs atomic terrain-map saves within the existing Notebook persistence system. It validates paths, source revisions, manifests, and tile patches before replacing the destination file.
// Atomic tiled-map replacement within the existing notebook persistence router.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateManifest,readHeader,layout,headerFor,validateTile} from '../../../public/MetaWorld/TerrainMaps/Format.mjs';
import {withFileWriteLock} from './conditionalWrite.mjs';
export async function mapRevision(file){try{const s=await fs.stat(file,{bigint:true});return [s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function mapPath(root,input){if(typeof input!=='string'||!/\.nvmap$/i.test(input)||input.includes('\\')||input.split('/').some(s=>s==='..'||s==='.')||path.isAbsolute(input))throw Error('Expected a relative Notebook .nvmap path');const file=path.join(root,input),realRoot=await fs.realpath(root),parent=await fs.realpath(path.dirname(file));if(parent!==realRoot&&!parent.startsWith(realRoot+path.sep))throw Error('Map path leaves Notebook');try{if((await fs.lstat(file)).isSymbolicLink())throw Error('Map symlinks are not writable');}catch(e){if(e.code!=='ENOENT')throw e;}return file;}
export async function saveTerrainMap({root,payload,beforeReplace=async()=>{}}){const destination=await mapPath(root,payload.path);return withFileWriteLock(destination,async()=>{
 const m=validateManifest(payload.manifest),json=Buffer.from(JSON.stringify(m));if(json.length>1024**2)throw Error('Manifest exceeds 1 MiB');const l=layout(m,json.length),source=payload.sourcePath?await mapPath(root,payload.sourcePath):null;
 if(await mapRevision(destination)!==(source===destination?payload.revision:null))throw Error('Destination changed or already exists; reload or choose a new name');
 if(source&&await mapRevision(source)!==payload.revision)throw Error('Map changed on disk; reload or Save As from a fresh source');
 let input=null,temp=destination+'.'+randomUUID()+'.tmp',output=null;
 try{let original;if(source){input=await fs.open(source,'r');const header=Buffer.alloc(32);await input.read(header,0,32,0);original=readHeader(header);const body=Buffer.alloc(original.manifestBytes);await input.read(body,0,body.length,32);const previous=validateManifest(JSON.parse(body.toString()));if(JSON.stringify(previous.grid)!==JSON.stringify(m.grid)||JSON.stringify(previous.size)!==JSON.stringify(m.size)||JSON.stringify(previous.origin)!==JSON.stringify(m.origin)||!previous.biomes.every((v,i)=>m.biomes[i]===v)||!previous.materials.every((v,i)=>m.materials[i]===v))throw Error('Saving cannot change the grid or reorder existing palettes');}
 const patches=new Map();if(!Array.isArray(payload.tiles)||payload.tiles.length*l.tileBytes>32*1024**2)throw Error('Modified tiles exceed the 32 MiB save budget');for(const patch of payload.tiles){if(!Number.isInteger(patch.key)||patch.key<0||patch.key>=l.columns*l.rows||patches.has(patch.key))throw Error('Invalid tile index');const bytes=Buffer.from(patch.data,'base64');validateTile(m,bytes,patch.key%l.columns,Math.floor(patch.key/l.columns));patches.set(patch.key,bytes);}
 output=await fs.open(temp,'wx');const prefix=Buffer.alloc(l.payloadOffset);prefix.set(headerFor(m,json.length));prefix.set(json,32);await output.writeFile(prefix);
 const tile=Buffer.alloc(l.tileBytes);if(!source){const e=payload.initialElevation;if(!Number.isFinite(e))throw Error('Initial elevation must be finite');for(let i=0;i<tile.length;i+=16){tile.writeDoubleLE(e,i);tile.writeUInt32LE(m.materials.length>1?1:0,i+12);}}
 for(let k=0;k<l.columns*l.rows;k++){let bytes=patches.get(k);if(!bytes){if(input){const {bytesRead}=await input.read(tile,0,tile.length,original.payloadOffset+k*l.tileBytes);if(bytesRead!==tile.length)throw Error('Truncated source map');}bytes=tile;}await output.writeFile(bytes);}
 await output.sync();await output.close();output=null;if(source&&await mapRevision(source)!==payload.revision)throw Error('Source changed while saving');if(await mapRevision(destination)!==(source===destination?payload.revision:null))throw Error('Destination changed while saving');await beforeReplace(destination);await fs.rename(temp,destination);return {success:true,path:payload.path,revision:await mapRevision(destination)};
 }finally{await input?.close();await output?.close();await fs.rm(temp,{force:true});}
 });}

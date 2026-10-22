// Nodevision/ApplicationSystem/public/Voxels/GoxPlacementUI.mjs
// Preserves legacy GOX import callers and redirects source selection to shared model controls.
import {readFileAsDataUrl,saveNotebookBinaryFromDataUrl} from '/ToolbarJSONfiles/insertMediaIO.mjs';
import {decodeGox} from './GoxCodec.mjs';
export async function importLocalGox(file,worldPath=''){
 if(!file?.name?.toLowerCase().endsWith('.gox'))throw Error('Choose a .gox file');if(file.size>128*1024*1024)throw Error('GOX exceeds 128 MiB limit');await decodeGox(await file.arrayBuffer());const directory=String(worldPath).replace(/^\/?Notebook\//,'').split('/').slice(0,-1).join('/'),name=file.name.replace(/[^a-z0-9._-]/gi,'_');const path=[directory,'assets',crypto.randomUUID()+'-'+name].filter(Boolean).join('/');await saveNotebookBinaryFromDataUrl(path,await readFileAsDataUrl(file));return path;
}
export {openModelPicker as openGoxPicker,openModelPlacementSettings as openGoxPlacementSettings} from '/Models/ModelPlacementUI.mjs';

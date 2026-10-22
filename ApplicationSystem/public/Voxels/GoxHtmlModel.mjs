// Nodevision/ApplicationSystem/public/Voxels/GoxHtmlModel.mjs
// Loads original GOX artwork into the existing HTML model panel using the shared voxel renderer.
import {decodeGox} from './GoxCodec.mjs';
import {VoxelScene} from './VoxelScene.mjs';
export async function loadGoxHtmlModel(source){
 const response=await fetch(source);if(!response.ok)throw Error('Could not load GOX model ('+response.status+')');
 const model=await decodeGox(await response.arrayBuffer()),view=new VoxelScene();
 try{await view.load(model);view.root.rotation.x=-Math.PI/2;view.root.userData.disposeModel=()=>view.dispose();return view.root;}
 catch(error){view.dispose();throw error;}
}

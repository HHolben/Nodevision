// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionCapture/Geometry.mjs
// Converts local Y-up region cells to valid GOX Z-up cells and verifies exact coordinate/RGBA round trips.
import {newModel,newLayer,setVoxel,voxels} from '../../Voxels/VoxelModel.mjs';
import {encodeGox,decodeGox} from '../../Voxels/GoxCodec.mjs';
import {LIMITS} from './Region.mjs';
export const toGox=([x,y,z])=>[x,-z-1,y];
export const fromGox=([x,y,z])=>[x,z,-y-1];
export function regionModel(region){const model=newModel();model.layers=region.materials.map((m,i)=>newLayer(`${i+1}: ${m.materialId}`));if(!model.layers.length)model.layers=[newLayer('Empty excavation')];for(const cell of region.cells)setVoxel(model.layers[cell.material],toGox(cell.at),cell.rgba);return model;}
export function verifyGeometry(region,model){if(model.readOnly||model.layers.length!==Math.max(1,region.materials.length))throw Error('Captured GOX has unexpected layers or semantics');const expected=new Map(region.cells.map(c=>[c.material+':'+c.at.join(','),c.rgba.join(',')]));let count=0;for(let i=0;i<model.layers.length;i++){const layer=model.layers[i];if(!layer.visible||layer.matrix)throw Error('Captured GOX layer transform/visibility changed');for(const {pos,color} of voxels(layer)){if(expected.get(i+':'+fromGox(pos).join(','))!==color.join(','))throw Error('Captured GOX voxel round trip differs');count++;}}if(count!==expected.size)throw Error('Captured GOX occupancy count differs');return true;}
export async function encodeRegion(region,options={}){const bytes=await encodeGox(regionModel(region),options);if(bytes.length>LIMITS.bytes)throw Error('Captured GOX exceeds 64 MiB');verifyGeometry(region,await decodeGox(bytes,options));return bytes;}

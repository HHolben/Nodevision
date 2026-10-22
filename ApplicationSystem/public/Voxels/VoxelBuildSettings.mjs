// Nodevision/ApplicationSystem/public/Voxels/VoxelBuildSettings.mjs
// Session-scoped precision settings; no document properties or file history are changed.
import { position } from './VoxelModel.mjs';
export const buildDefaults=()=>({plane:'xz',height:0,constraint:'free',anchor:[0,0,0],symmetryOrigin:[0,0,0],collision:'merge',hollow:false,walls:false,thickness:1,axis:'y',gridInterval:8,gridVisible:true,bounds:false});
export function buildSettings(input,current=buildDefaults()){
 const s={...current,...input};if(!['xy','xz','yz'].includes(s.plane))throw Error('Expected XY, XZ or YZ plane');if(!Number.isInteger(s.height)||Math.abs(s.height)>1000000)throw Error('Work height must be an integer within the voxel bounds');
 if(!['free','x','y','z','xy','xz','yz'].includes(s.constraint))throw Error('Invalid constraint');if(!['replace','merge','cancel'].includes(s.collision))throw Error('Invalid collision policy');if(!['x','y','z'].includes(s.axis))throw Error('Invalid shape axis');
 for(const k of ['anchor','symmetryOrigin'])position(s[k]);if(!Number.isInteger(s.thickness)||s.thickness<1||s.thickness>256)throw Error('Thickness must be 1–256');if(!Number.isInteger(s.gridInterval)||s.gridInterval<1||s.gridInterval>64)throw Error('Grid interval must be 1–64');return s;
}

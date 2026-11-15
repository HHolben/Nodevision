// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/SurfaceNetsCompatibility.test.mjs
// These golden hashes were measured from the pre-optimization Surface Nets implementation at commit b228d5f. They protect exact vertex, normal, UV, triangle, material and occupancy output for signed terrain chunks containing solids, features and liquids.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createVoxelGenerator} from '../ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {surfaceNetSteps} from './SurfaceNets.mjs';
const expected=[[[0, 0, 0], "55ab148f9ec4f57ad10ce48e930c38c06a3810eb67383ea4843cbbde24f3bd1d"], [[0, 4, 0], "5aa9d99a68d268100dfd3ee8f7130a227da1da3f9833dcda74e3d0d6b3c86e70"], [[4, 0, 4], "ec714d2bb7069da19eef36517d4ffd76229a1e76bebd59e49ca4eb9044242564"], [[4, 4, 4], "de6d9d06078fd6318b5cc97142bdbdbaa2d88f5899e9712c6f327f5073161a06"], [[-4, 0, -4], "0fab3abd69a87b35a6c6d0796200992b608882e5c33b48407fe219de0a9dbb8c"], [[-4, 4, -4], "ea894d9ddd8de99196b7f679bba105162ed1fb46ae4d5b6dcb800492e135e487"], [[50, 0, 50], "736c79cf27093e7750b90e5380ce8a3ca1ce667e4040fc2efee11dbc5c2092aa"], [[50, 2, 50], "ec7cff81983119dcfee5d2e12b121a01b05255995ac7e0466049861e3288e905"]];
test('optimized extraction preserves exact reference output',()=>{
 const g=createVoxelGenerator({id:'profile',position:[0,0,0],size:[1000,64,2000],worldExtent:{mode:'infinite'},voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:true,water:true,caves:true}});
 for(const [cell,hash] of expected){const result=drainSteps(surfaceNetSteps(g.generateChunk(...cell),cell,g.getRenderVoxel));assert.equal(createHash('sha256').update(JSON.stringify(result)).digest('hex'),hash,cell.join(','));}
});

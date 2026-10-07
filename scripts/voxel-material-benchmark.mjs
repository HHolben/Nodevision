// Nodevision/scripts/voxel-material-benchmark.mjs
// This benchmark measures warm deterministic chunk generation and exposed-face meshing across a fixed set of V1 terrain coordinates.
import {createVoxelGenerator} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import {meshVoxelChunk} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelChunkMesher.mjs';
const def={size:[1000,128,1000],generator:{id:'nodevision-terrain-v1',version:1,seed:123456}};
const g=createVoxelGenerator(def), samples=[],offsetX=Number(process.argv[2]||0),offsetZ=Number(process.argv[3]||0),layer=Number(process.argv[4]||2);
for(let i=0;i<110;i++){const cell=[offsetX+i%11,layer,offsetZ+Math.floor(i/11)],start=performance.now(),data=g.generateChunk(...cell),generated=performance.now(),mesh=meshVoxelChunk(data,cell,g.getVoxel);if(i>=10)samples.push({generationMs:generated-start,meshingMs:performance.now()-generated,faces:mesh.faceCount});}
const summary={};for(const name of ['generationMs','meshingMs']){const a=samples.map(s=>s[name]).sort((a,b)=>a-b);summary[name]={p50:a[50],p95:a[95]};}console.log(JSON.stringify({summary,featureStats:g.featureStats,worstGenerationMs:Math.max(...samples.map(s=>s.generationMs)),samples}));

// Nodevision/scripts/geographic-benchmark.mjs
// This repeatable benchmark measures the bounded raster import and existing chunk adapter with the maximum supported sample count.
import { writeArrayBuffer } from '../ApplicationSystem/public/vendor/geographic/reader.mjs';
import { decodeRaster } from '../ApplicationSystem/public/MetaWorld/Geographic/RasterImport.mjs';
import { prepareGeographic } from '../ApplicationSystem/public/MetaWorld/Geographic/Definition.mjs';
import { unproject } from '../ApplicationSystem/public/MetaWorld/Geographic/Coordinates.mjs';
import { createGeographicTerrain } from '../ApplicationSystem/public/MetaWorld/Geographic/Terrain.mjs';
const n=512,values=Float32Array.from({length:n*n},(_,i)=>100+(i%n)*.1);
const bytes=writeArrayBuffer(values,{width:n,height:n,ModelPixelScale:[1,1,0],ModelTiepoint:[0,0,0,676000,4358000,0],GTModelTypeGeoKey:1,ProjectedCSTypeGeoKey:32634,GTRasterTypeGeoKey:1});
const start=performance.now(),r=await decodeRaster(bytes,{path:'/Notebook/benchmark.tif',sha256:'0'.repeat(64)}),decoded=performance.now();
const a=unproject([676050,4357550]),b=unproject([676450,4357950]),g=prepareGeographic({elevation:r,crop:[...a,...b]}),prepared=performance.now();
const terrain=createGeographicTerrain({geographic:g,size:g.size,generator:{seed:1}}),chunks=[];
for(let i=0;i<20;i++){const t=performance.now();terrain.generateChunk(i,1,1);chunks.push(performance.now()-t);}
console.log(JSON.stringify({pixels:n*n,inputBytes:bytes.byteLength,snapshotBytes:JSON.stringify(g).length,decodeMs:decoded-start,prepareMs:prepared-decoded,chunkAverageMs:chunks.reduce((a,b)=>a+b)/chunks.length,chunkMaxMs:Math.max(...chunks)},null,2));

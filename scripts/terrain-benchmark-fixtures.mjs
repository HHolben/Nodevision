// Nodevision/scripts/terrain-benchmark-fixtures.mjs
// Builds deterministic terrain fixtures, including a real synthetic GeoTIFF import and the supplied saved geographic world, for streaming comparisons.
import { fromArrayBuffer, writeArrayBuffer } from '/vendor/geographic/reader.mjs';
import { rasterMetadata } from '/MetaWorld/Geographic/RasterMetadata.mjs';
import { importCrop } from '/MetaWorld/Geographic/WindowImport.mjs';
import { finishRecipe } from '/MetaWorld/Geographic/RecipeV2.mjs';
import { validatePath } from '/MetaWorld/Paths/PathDefinition.mjs';
import { ribbonForPath, samplePath } from '/MetaWorld/Paths/PathGeometry.mjs';
const base={id:'terrain',type:'procedural-voxel-world',position:[0,0,0],size:[32,32,32],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,water:false,caves:false}};
export async function terrainBenchmarkCases(){
  const values=new Float32Array(64*64);for(let z=0;z<64;z++)for(let x=0;x<64;x++)values[x+64*z]=100+x*.0625+z*.03125;
  const image=await (await fromArrayBuffer(writeArrayBuffer(values,{width:64,height:64,ModelPixelScale:[.5,.5,0],ModelTiepoint:[0,0,0,675000,4362000,0],GTModelTypeGeoKey:1,ProjectedCSTypeGeoKey:32634,GTRasterTypeGeoKey:1,SampleFormat:[3],BitsPerSample:[32]}))).getImage();
  const settings={crop:rasterMetadata(image).bounds,fitCoverage:true};
  const geographic=finishRecipe(await importCrop({image,asset:async()=>({path:'/Notebook/synthetic-dem.tif',sha256:'a'.repeat(64)}),stats:()=>({})},settings),settings);
  const original=await (await fetch('/test/original')).json(),supplied=original.objects.find(o=>o.terrainSource==='geographic');
  return [{name:'small-procedural',definition:base},{name:'synthetic-geotiff',definition:{...base,terrainSource:'geographic',geographic,size:geographic.size}},
    {name:'supplied-geographic',definition:supplied},{name:'4km-procedural',definition:{...base,size:[4096,64,4096]}},
    {name:'excavation-and-object',definition:base,edited:true}];
}

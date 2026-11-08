// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/TerrainCoverage.test.mjs
// These authoring coverage tests distinguish geographic holes from explicit finite authored-map composition. Pending data never grants permission to create terrain over an unloaded source.
import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainPointCovered} from './TerrainCoverage.mjs';
test('geographic NoData cannot inherit a procedural fallback',()=>{
 const runtime={definition:{terrainSource:'geographic',terrainMap:{outside:'procedural'}},sampleTerrainSource:()=>({covered:false,elevation:null})};
 assert.equal(terrainPointCovered(runtime,10,10),false);
 runtime.sampleTerrainSource=()=>({covered:true,elevation:1});assert.equal(terrainPointCovered(runtime,10,10),true);
 runtime.sampleTerrainSource=()=>({covered:true,pending:true});assert.equal(terrainPointCovered(runtime,10,10),false);
});
test('authored maps retain explicit composition while pending samples stay unavailable',()=>{
 for(const terrainSource of ['map','hybrid']){
  const runtime={definition:{terrainSource,terrainMap:{outside:'empty'}},sampleTerrainSource:()=>({covered:false})};
  assert.equal(terrainPointCovered(runtime,0,0),false);runtime.definition.terrainMap.outside='procedural';assert.equal(terrainPointCovered(runtime,0,0),true);
  runtime.sampleTerrainSource=()=>({covered:false,pending:true});assert.equal(terrainPointCovered(runtime,0,0),false);
 }
});

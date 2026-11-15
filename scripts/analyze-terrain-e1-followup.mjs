// Nodevision/scripts/analyze-terrain-e1-followup.mjs
// Validate complete paired measurements before producing compact comparisons. Preserve full-case outliers, and reject interrupted traces instead of silently trimming them from frame statistics.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const data=JSON.parse(await fs.readFile(process.argv[2]||'docs/TerrainE1Followup.json','utf8'));
assert.equal(data.complete,true);assert.equal(data.results.length,32);
assert.equal(new Set(data.results.map(r=>[r.scenario,r.terrain,r.vegetation,r.trial,r.variant].join(':'))).size,32);
const pairs=[];
for(const before of data.results.filter(r=>r.variant==='baseline')){
 const after=data.results.find(r=>r.variant==='modified'&&r.scenario===before.scenario&&r.terrain===before.terrain&&r.vegetation===before.vegetation&&r.trial===before.trial);
 assert.ok(after);assert.ok(before.drained&&after.drained);
 const difference=after.imageDifference||before.imageDifference;assert.ok(difference);assert.equal(difference.changedPixels,0);
 assert.equal(before.phases.stationary.drawCallsMean,after.phases.stationary.drawCallsMean);
 assert.equal(before.phases.stationary.trianglesMean,after.phases.stationary.trianglesMean);
 const phases={};
 for(const phase of ['stationary','walking','running','backtracking']){
  const a=before.phases[phase],b=after.phases[phase];
  for(const r of [a,b])assert.ok(r.frameMs.max<5000,'Interrupted trace: rerun its entire pair');
  phases[phase]={beforeMs:a.frameMs.mean,afterMs:b.frameMs.mean,reductionPercent:(1-b.frameMs.mean/a.frameMs.mean)*100,beforeP95:a.frameMs.p95,afterP95:b.frameMs.p95,beforeDriverMs:a.driverMs?.mean??null,afterDriverMs:b.driverMs?.mean??null,beforeUpdateMs:a.updateMs.mean,afterUpdateMs:b.updateMs.mean,beforePrepareMs:a.prepareMs.mean,afterPrepareMs:b.prepareMs.mean,beforeDrawCalls:a.drawCallsMean,afterDrawCalls:b.drawCallsMean,beforeTriangles:a.trianglesMean,afterTriangles:b.trianglesMean};
 }
 pairs.push({scenario:before.scenario,terrain:before.terrain,vegetation:before.vegetation,trial:before.trial,coarseVertices:[before.coarseVertices,after.coarseVertices],coarseAttributeBytes:[before.coarseVertices*44,after.coarseVertices*44],preparationMs:[before.preparationMs,after.preparationMs],phases});
}
console.log(JSON.stringify({pairs},null,2));

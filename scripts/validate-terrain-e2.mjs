// Nodevision/scripts/validate-terrain-e2.mjs
// Check retained visual evidence and actual runtime benchmark coverage without treating scene states or software timings as a claim of hardware FPS or zero popping.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=async name=>JSON.parse(await fs.readFile(new URL('../docs/'+name,import.meta.url),'utf8'));
const visual=await read('TerrainE2VisualMetrics.json'),perf=await read('TerrainE2Performance.json');assert.equal(visual.complete,true);assert.equal(perf.complete,true);assert.equal(visual.results.length,4);assert.equal(perf.results.length,36);
assert.equal((await fs.readdir(new URL('../docs/TerrainE2Visuals/',import.meta.url))).filter(n=>n.endsWith('.png')).length,72);
for(const mode of ['voxel','polygonal']){
 const a=visual.results.find(r=>r.mode===mode&&r.variant==='baseline'),b=visual.results.find(r=>r.mode===mode&&r.variant==='modified');
 for(const key of ['id','seed','origin','min','max','chunks'])assert.deepEqual(a[key],b[key]);assert.ok(b.chunks>1);assert.ok(b.classifiedVertices>0);
 const peak=r=>Math.max(...r.frames.map(f=>f.change?.changedSilhouetteFraction||0));assert.ok(peak(b)<peak(a)*.25);
 for(const f of b.frames){assert.ok(f.coverage>0);if(f.timeMs<=200)assert.equal(f.detailFraction,0);}
 assert.ok(b.frames.some(f=>f.detailFraction>0&&f.detailFraction<1));assert.equal(b.frames.at(-1).detailFraction,1);
 assert.deepEqual(await fs.readFile(new URL(`../docs/TerrainE2Visuals/${mode}-baseline-700.png`,import.meta.url)),await fs.readFile(new URL(`../docs/TerrainE2Visuals/${mode}-modified-700.png`,import.meta.url)));
}
for(const a of perf.results.filter(r=>r.variant==='baseline')){
 const b=perf.results.find(r=>r.variant==='modified'&&['scenario','mode','enabled','trial'].every(k=>r[k]===a[k]));assert.ok(b&&a.drained&&b.drained);assert.equal(a.fingerprint.geometry,b.fingerprint.geometry);assert.equal(a.fingerprint.normals,b.fingerprint.normals);
 for(const r of [a,b])for(const p of Object.values(r.phases)){assert.ok(p.frameMs.samples>=60);assert.ok(p.frameMs.mean>0);const v=p.vegetation;assert.ok(v.bytes<=8*1048576);assert.ok(v.regions<=64);if(v.continuity){assert.ok(v.continuity.trackedFeatures<=4095);assert.ok(v.continuity.transitioning<=8);assert.ok(v.transitionRegions<=4);assert.ok(v.transitionBytes<=2*1048576);}assert.ok(p.meshCache.bytes<=p.meshCache.maxBytes);}
}
const recovery=await read('TerrainE2ResumeResults.json');assert.equal(recovery.complete,true);assert.equal(recovery.results.length,8);
assert.equal((await fs.readdir(new URL('../docs/TerrainE2ResumeVisuals/',import.meta.url))).filter(n=>n.endsWith('.png')).length,16);
for(const r of recovery.results){
 assert.equal(r.loadedRevisionUnchanged,true);assert.equal(r.frameMs.samples,180);assert.ok(r.samples.some(p=>p.value>0&&p.value<1));assert.equal(r.samples.at(-1).value,1);
 const visible=r.variant==='after';for(const stage of ['invalidated','recovering'])assert.equal(r.captures.find(c=>c.stage===stage).proxyVisible,visible);assert.equal(r.captures.at(-1).proxyVisible,false);
 const v=r.snapshot;assert.ok(v.bytes<=8*1048576&&v.transitionBytes<=2*1048576&&v.transitionRegions<=4&&v.continuity.transitioning<=8);
 if(r.variant==='before'){const corrected=recovery.results.find(t=>t.variant==='after'&&t.mode===r.mode&&t.trial===r.trial);assert.equal(corrected.id,r.id);assert.equal(corrected.drawCalls.mean,r.drawCalls.mean);assert.equal(corrected.triangles.mean,r.triangles.mean);}
}
assert.equal(createHash('sha256').update(await fs.readFile(new URL('../Notebook/test.html',import.meta.url))).digest('hex'),'75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292');
console.log('PASS: E2 retained WebGL continuity metrics, 36 historical production cases plus 8 rendered invalidation/recovery cases, source/normal identity, bounded memory/transition state and unchanged Notebook');

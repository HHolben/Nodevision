// Nodevision/scripts/validate-terrain-e3.mjs
// Validate retained visual and performance evidence independently of benchmark timings. Geometry-only image identity, per-pair render workloads and the protected Notebook checksum must hold before publishing the report.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=async name=>JSON.parse(await fs.readFile(new URL('../docs/'+name,import.meta.url),'utf8'));
const visual=await read('TerrainE3VisualMetrics.json'),performance=await read('TerrainE3Performance.json'),isolation=await read('TerrainE3NormalIsolation.json'),cpu=await read('TerrainE3CPU.json');
assert.equal(visual.complete,true);assert.equal(visual.records.length,15);assert.equal(performance.complete,true);assert.equal(performance.results.length,24);assert.equal(isolation.complete,true);assert.equal(isolation.results.length,36);assert.equal(cpu.results.length,36);
assert.equal((await fs.readdir(new URL('../docs/TerrainE3Visuals/',import.meta.url))).filter(name=>name.endsWith('.png')).length,90);
for(const name of ['gentle','steep','edited']){
 const a=visual.records.find(r=>r.name===name&&r.variant==='original'),b=visual.records.find(r=>r.name===name&&r.variant==='modified');
 for(const key of ['vertices','triangles','bufferBytes','heightRmseM','heightMeanErrorM'])assert.equal(a[key],b[key]);
 assert.ok(b.normalMeanErrorDegrees<a.normalMeanErrorDegrees*.1);assert.equal(b.seamNormalMaxComponentDifference,0);
 for(const style of ['unlit','wire','flat'])assert.deepEqual(await fs.readFile(new URL(`../docs/TerrainE3Visuals/${name}-original-${style}.png`,import.meta.url)),await fs.readFile(new URL(`../docs/TerrainE3Visuals/${name}-modified-${style}.png`,import.meta.url)));
}
for(const a of performance.results.filter(r=>r.variant==='baseline')){
 const b=performance.results.find(r=>r.variant==='modified'&&r.scenario===a.scenario&&r.trial===a.trial&&r.terrain===a.terrain&&r.vegetation===a.vegetation);assert.ok(a.drained&&b.drained);
 for(const key of ['geometry','vertices','triangles','bufferBytes'])assert.equal(a.fingerprint[key],b.fingerprint[key]);assert.notEqual(a.fingerprint.normals,b.fingerprint.normals);
 for(const key of ['drawCallsMean','trianglesMean'])assert.equal(a.phases.stationary[key],b.phases.stationary[key]);
 for(const r of [a,b])for(const p of Object.values(r.phases)){assert.ok(p.cache.bytes<=p.cache.maxBytes);assert.ok(p.cache.entries<=p.cache.maxEntries);}
}
for(const a of isolation.results.filter(r=>r.variant==='baseline')){
 const b=isolation.results.find(r=>r.variant==='modified'&&r.scenario===a.scenario&&r.trial===a.trial&&r.shading===a.shading);assert.equal(a.calls,b.calls);assert.equal(a.triangles,b.triangles);
}
const hash=createHash('sha256').update(await fs.readFile(new URL('../Notebook/test.html',import.meta.url))).digest('hex');assert.equal(hash,'75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292');
console.log('PASS E3: 90 rendered images; 12 production benchmark pairs; 18 normal-isolation pairs; 36 CPU trials; exact source geometry/materials; bounded caches; Notebook checksum unchanged');

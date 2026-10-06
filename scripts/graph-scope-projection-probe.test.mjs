// Nodevision/scripts/graph-scope-projection-probe.test.mjs
// These tests validate the limited identity-planning experiment without treating it as a production scope renderer. They exercise source immutability, multiplicity, selected descendants, and reconstruction after a graph revision.
import assert from 'node:assert/strict';
import { projectLoadedDirectories } from './graph-scope-projection-probe.mjs';
const nodes = [
  {id:'Root',type:'directory'}, {id:'P',parent:'Root',type:'directory'},
  {id:'P/docs',parent:'P',type:'directory'}, {id:'P/assets',parent:'P',type:'directory'},
  {id:'P/docs/A.html',parent:'P/docs',type:'file'}, {id:'P/docs/B.html',parent:'P/docs',type:'file'},
  {id:'P/assets/C.svg',parent:'P/assets',type:'file'}
].map(Object.freeze);
const records = [
  {id:'r1',sourcePath:'P/docs/A.html',targetPath:'P/assets/C.svg'},
  {id:'r2',sourcePath:'P/docs/B.html',targetPath:'P/assets/C.svg'},
  {id:'r3',sourcePath:'P/docs/A.html',targetPath:'P/docs/B.html'}
].map(Object.freeze);
const selected = Object.freeze(['P/docs/A.html','P/docs/B.html']);
const before = JSON.stringify({nodes,records,selected});
const projection = projectLoadedDirectories(nodes,records,selected);
assert.equal(projection.representatives.get(selected[0]),'P/docs');
assert.equal(projection.selectedCounts.get('P/docs'),2);
assert.equal(projection.edges.size,1);
assert.deepEqual([...projection.edges.values()][0].recordIds,['r1','r2']);
assert.equal(projection.internalCounts.get('P/docs'),1);
assert.equal(JSON.stringify({nodes,records,selected}),before);
for(let i=0;i<100;i++) {
  const next = projectLoadedDirectories(nodes,records,selected);
  assert.deepEqual([...next.representatives],[...projection.representatives]);
  assert.deepEqual([...next.edges],[...projection.edges]);
}
// Revision invalidation is explicit: recompute from new plain identities, never retain Cy elements.
const nextNodes = nodes.filter(node=>node.id!=='P/docs/B.html');
const nextRecords = records.filter(record=>!['r2','r3'].includes(record.id));
const next = projectLoadedDirectories(nextNodes,nextRecords,[selected[0]]);
assert.equal(next.representatives.has('P/docs/B.html'),false);
assert.equal(next.selectedCounts.get('P/docs'),1);
assert.deepEqual([...next.edges.values()][0].recordIds,['r1']);
assert.equal(projection.selectedCounts.get('P/docs'),2);
console.log('PASS: investigation-only projection identity, multiplicity, source immutability and revision reconstruction');

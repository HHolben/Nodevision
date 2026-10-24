// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathJoin.test.mjs
// Path junction projection retains elevations and translated world coordinates.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nearestPathPoint} from './PathJoin.mjs';
test('branch clicks snap to centerline and interpolated elevation',()=>{
 assert.deepEqual(nearestPathPoint([[0,2,0],[10,6,0]],[5,20,.8]),[5,4,0]);
 assert.deepEqual(nearestPathPoint([[0,2,0],[10,6,0]],[-3,0,1]),[0,2,0]);
 assert.deepEqual(nearestPathPoint([[0,2,0],[10,6,0]],[8,0,5],[3,7,5]),[8,11,5]);
});

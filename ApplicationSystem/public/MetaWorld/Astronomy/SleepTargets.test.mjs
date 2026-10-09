// Nodevision/ApplicationSystem/public/MetaWorld/Astronomy/SleepTargets.test.mjs
// These tests ensure named sleep phases follow the observer's solar day and always select ordered future occurrences.
import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingSleepTargets,nextSleepTarget,SLEEP_TARGETS } from './SleepTargets.mjs';
const observer={latitude:40,longitude:-90},instant=Date.parse('2026-10-07T18:00:00Z');
test('all seven sleep phases are available in upcoming order and never rewind',()=>{
 const options=upcomingSleepTargets(instant,observer);assert.equal(options.length,7);
 assert.equal(new Set(options.map(o=>o.id)).size,7);
 for(let i=0;i<options.length;i++){
   assert.ok(options[i].instant>instant);if(i)assert.ok(options[i].instant>=options[i-1].instant);
   assert.ok(nextSleepTarget(options[i].instant+2000,observer,options[i].id)>options[i].instant+12*3600000);
 }
 const night=nextSleepTarget(instant,observer,'nightfall');
 assert.equal(upcomingSleepTargets(night+1000,observer)[0].id,'midnight');
 assert.deepEqual(SLEEP_TARGETS.map(o=>o[1]),['Daybreak','Mid morning','Noon','Mid afternoon','Evening','Nightfall','Midnight']);
});
test('solar phases respond to longitude and polar unavailable phases are omitted',()=>{
 assert.notEqual(nextSleepTarget(instant,observer,'noon'),nextSleepTarget(instant,{latitude:40,longitude:0},'noon'));
 const options=upcomingSleepTargets(Date.parse('2026-06-21T12:00:00Z'),{latitude:90,longitude:0});
 assert.ok(options.every(o=>['noon','midnight'].includes(o.id)));
 assert.equal(nextSleepTarget(instant,observer,'invalid'),null);
});

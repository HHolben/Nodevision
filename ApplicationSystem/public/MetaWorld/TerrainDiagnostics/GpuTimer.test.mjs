// Nodevision/ApplicationSystem/public/MetaWorld/TerrainDiagnostics/GpuTimer.test.mjs
// These tests verify nonblocking timer limits, unsupported contexts, disjoint invalidation and teardown without relying on a graphics driver. Pending results must never be read before the driver reports availability.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGpuTimer} from './GpuTimer.mjs';
function fixture(){
 const queries=[],deleted=[],state={ready:false,disjoint:false,lost:false,current:null,reads:0},ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2};
 const gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,CURRENT_QUERY:5,getExtension:()=>ext,isContextLost:()=>state.lost,getParameter:()=>state.disjoint,getQuery:()=>state.current,
 createQuery(){const q={};queries.push(q);return q;},beginQuery(_,q){state.current=q;},endQuery(){state.current=null;},deleteQuery(q){deleted.push(q);},
 getQueryParameter(q,k){if(k===3)return state.ready;assert.ok(state.ready);state.reads++;return 2500000;}};
 return {timer:createGpuTimer({getContext:()=>gl}),state,queries,deleted};
}
test('disabled and unsupported GPU profiling does not create queries',()=>{
 let calls=0;const timer=createGpuTimer({getContext(){calls++;return {getExtension:()=>null};}});
 assert.equal(timer.begin(false),false);assert.equal(calls,0);assert.equal(timer.begin(true),false);assert.equal(timer.snapshot().elapsedMs,null);assert.equal(timer.snapshot().supported,false);timer.dispose();
});
test('at most four pending queries are polled without waiting, then valid nanoseconds become milliseconds',()=>{
 const {timer,state,queries,deleted}=fixture();for(let i=0;i<4;i++){assert.ok(timer.begin(true));timer.end();}
 assert.equal(timer.begin(true),false);assert.equal(queries.length,4);assert.equal(state.reads,0);
 state.ready=true;assert.ok(timer.begin(true));assert.equal(timer.snapshot().elapsedMs,2.5);assert.equal(timer.snapshot().samples,4);timer.end();timer.dispose();assert.equal(deleted.length,5);
});
test('disjoint and lost contexts discard pending results; disable clears stale timings',()=>{
 const {timer,state,deleted}=fixture();timer.begin(true);timer.end();state.disjoint=true;assert.equal(timer.begin(true),false);assert.equal(timer.snapshot().discarded,1);assert.equal(deleted.length,1);assert.equal(state.reads,0);
 state.disjoint=false;timer.begin(true);timer.end();state.ready=true;timer.begin(true);timer.end();assert.equal(timer.snapshot().elapsedMs,2.5);timer.begin(false);assert.equal(timer.snapshot().elapsedMs,null);
 timer.begin(true);timer.end();state.lost=true;assert.equal(timer.begin(true),false);assert.equal(timer.snapshot().pending,0);state.lost=false;assert.ok(timer.begin(true),'restored contexts reacquire query support');timer.end();timer.dispose();
});

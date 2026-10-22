// Nodevision/ApplicationSystem/public/Sessions/BridgingProgress.test.mjs
// Net growth, monotonic elapsed time, composition deferral and single-flight completion are tested without browser timers.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bridgingProgress,createBridgingProgress,normalizeBridgingGoal} from './BridgingProgress.mjs';
const goal={wordsEnabled:true,timerEnabled:true,targetGrowth:100,durationMs:60000};
test('fixed baseline and net growth including deletions',()=>{
  assert.equal(bridgingProgress(goal,500,500,0).requiredWordCount,600);
  assert.equal(bridgingProgress(goal,500,500,0).netWordsAdded,0);
  assert.equal(bridgingProgress(goal,500,450,100).netWordsAdded,-50);
  const progress=bridgingProgress(goal,500,550,200);assert.equal(progress.netWordsAdded,50);assert.equal(progress.remainingWords,50);assert.equal(progress.reason,null);
  assert.equal(bridgingProgress(goal,500,600,300).reason,'word target');
  assert.equal(bridgingProgress(goal,500,500,60000).reason,'timer');
  for(const targetGrowth of [0,'',null,NaN])assert.throws(()=>normalizeBridgingGoal({...goal,targetGrowth}),/positive integer/);
  const timerOnly=normalizeBridgingGoal({...goal,wordsEnabled:false,targetGrowth:0});
  assert.equal(bridgingProgress(timerOnly,500,500,0).reason,null);
  assert.equal(bridgingProgress(timerOnly,500,500,60000).reason,'timer');
  assert.throws(()=>normalizeBridgingGoal({...goal,wordsEnabled:false,timerEnabled:false}));
  assert.throws(()=>normalizeBridgingGoal({...goal,targetGrowth:-1}));
});
test('simultaneous triggers save once and use monotonic elapsed time',async()=>{
  let now=10,count=500,saves=0,summary,resolve;
  const model=createBridgingProgress({goal,initialWordCount:500,clock:()=>now,readCount:()=>count,save:()=>{saves++;return new Promise(r=>resolve=r);},onComplete:s=>summary=s});
  now=60010;count=600;model.update();model.update();void model.finish('manual');assert.equal(saves,1);resolve();await Promise.resolve();await Promise.resolve();assert.equal(summary.elapsedMs,60000);assert.equal(summary.currentWordCount,600);
});
test('composition defers completion; failure retains retry and frozen baseline',async()=>{
  let composing=true,saves=0,summary,error;const model=createBridgingProgress({goal,initialWordCount:500,readCount:()=>600,composing:()=>composing,save:async()=>{if(++saves===1)throw Error('offline');},onComplete:s=>summary=s,onError:e=>error=e});
  model.update();assert.equal(saves,0);composing=false;model.update();await Promise.resolve();await Promise.resolve();assert.equal(model.phase,'failed');assert.equal(error.message,'offline');model.update();assert.equal(saves,1);await model.retry();assert.equal(summary.netWordsAdded,100);assert.equal(summary.reason,'word target');
});
test('retry preserves the original completion statistics',async()=>{
  let now=0,count=500,summary,fail=true;
  const model=createBridgingProgress({goal,initialWordCount:500,clock:()=>now,readCount:()=>count,save:async()=>{if(fail)throw Error('offline');},onError:()=>{},onComplete:value=>summary=value});
  now=1000;count=550;await model.finish('manual');now=9000;fail=false;await model.retry();assert.equal(summary.elapsedMs,1000);assert.equal(summary.currentWordCount,550);assert.equal(summary.reason,'manual');
});

// Nodevision/ApplicationSystem/public/Sessions/BridgingProgress.mjs
// Pure net-growth arithmetic and an idempotent completion controller use a monotonic clock and keep the baseline fixed across saves.
export function normalizeBridgingGoal(goal) {
  const targetGrowth=Number(goal.targetGrowth),durationMs=Number(goal.durationMs);
  if(!goal.wordsEnabled && !goal.timerEnabled)throw Error('Enable a word target, a timer, or both.');
  if(goal.wordsEnabled && (!Number.isSafeInteger(targetGrowth)||targetGrowth<=0))throw Error('Word growth must be a positive integer. Uncheck Word target for a timer-only session.');
  if(goal.timerEnabled && (!Number.isFinite(durationMs)||durationMs<=0))throw Error('Timer duration must be greater than zero.');
  return {...goal,targetGrowth,durationMs};
}
export function bridgingProgress(goal,initialWordCount,currentWordCount,elapsedMs) {
  const netWordsAdded=currentWordCount-initialWordCount,requiredWordCount=initialWordCount+goal.targetGrowth;
  const reason=goal.wordsEnabled && currentWordCount>=requiredWordCount?'word target':goal.timerEnabled && elapsedMs>=goal.durationMs?'timer':null;
  return {initialWordCount,currentWordCount,requiredWordCount,netWordsAdded,elapsedMs,remainingWords:Math.max(0,requiredWordCount-currentWordCount),remainingMs:Math.max(0,goal.durationMs-elapsedMs),reason};
}
export function createBridgingProgress({goal,initialWordCount,clock=()=>performance.now(),readCount,save,onUpdate,onComplete,onError,composing=()=>false}) {
  goal=normalizeBridgingGoal(goal);const started=clock();let phase='writing',pendingReason=null,finalStats=null;
  const snapshot=()=>bridgingProgress(goal,initialWordCount,readCount(),Math.max(0,clock()-started));
  async function finish(reason) {
    if(phase==='saving'||phase==='complete'||phase==='disposed')return;
    pendingReason ||= reason;
    if(composing())return;
    phase='saving';finalStats ||= {...snapshot(),reason:pendingReason};onUpdate?.(finalStats,phase);
    try {await save();if(phase==='disposed')return;phase='complete';onComplete({...finalStats,targetGrowth:goal.wordsEnabled?goal.targetGrowth:null});}
    catch(error){if(phase==='disposed')return;phase='failed';onError(error);onUpdate?.(finalStats,phase);}
  }
  function update() {
    if(phase!=='writing')return;
    const progress=snapshot();onUpdate?.(progress,phase);
    if(pendingReason||progress.reason)void finish(pendingReason||progress.reason);
  }
  return {update,finish,retry:()=>finish(pendingReason||'manual'),snapshot,get phase(){return phase;},dispose(){phase='disposed';}};
}

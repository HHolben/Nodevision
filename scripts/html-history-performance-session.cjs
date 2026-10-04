// Long-session samples compare early and late latency and garbage-collected browser counters.
module.exports=async({js,key,type,delay,measure,heap,cdp})=>{
  await js('historyPerf.configure(20000,true,"session")');
  const samples=[],before=await heap(),beforeLifecycle=await js('foundationDiagnostics.counts()');
  for(let i=0;i<120;i++){
    const action=async()=>{await type('abc');await key('Backspace');await js('(async()=>{await historyPerf.prepare("properties");await historyPerf.prepare("insertion");historyPerf.history("undo");historyPerf.history("redo");})()');};
    if(i<5||i>=115)samples.push({iteration:i,...await measure('mixed session',action)});
    else{await action();if(i%10===0)await delay(600);}
    if(i%20===0)await js('historyPerf.switchEditor()');
  }
  await delay(700);const after=await heap(),state=await js('historyPerf.snapshot()');
  if(state.history.undoEntries>100||state.history.retainedBytes>8388608)throw new Error('session capacity failed');
  await js(`(()=>{const c=historyPerf.current();for(let i=0;i<12;i++){c.transactions.run('fragment',()=>{const t=document.createElement('div');t.textContent=String(i).repeat(500000);c.editorElement.append(t);});c.transactions.run('remove fragment',()=>{const removed=c.editorElement.lastChild;window.perfRemoved=new WeakRef(removed);removed.remove();});}})()`);
  await delay(100);const retained=await heap(),retainedHistory=await js('historyPerf.snapshot().history');
  const retainedAlive=await js('!!perfRemoved.deref()');
  await js('historyPerf.current().editorElement.__nvProgrammaticHistory.clear()');await delay(100);
  const afterEviction=await heap(),released=await js('!perfRemoved.deref()');
  const composition=await measure('composition boundary',async()=>{
    await js('historyPerf.caret()');
    await cdp('Input.imeSetComposition',{text:'に',selectionStart:1,selectionEnd:1});
    await cdp('Input.imeSetComposition',{text:'日本',selectionStart:2,selectionEnd:2});
    await cdp('Input.insertText',{text:'日本'});
  });
  const afterLifecycle=await js('foundationDiagnostics.counts()');
  await js('historyPerf.dispose()');await delay(700);
  const disposed={memory:await heap(),lifecycle:await js('foundationDiagnostics.counts()'),providers:await js('window.NodevisionLiveFileContent.listProviders()')};
  return {before,after,beforeLifecycle,afterLifecycle,disposed,retained,retainedHistory,retainedAlive,afterEviction,released,state,samples,composition};
};

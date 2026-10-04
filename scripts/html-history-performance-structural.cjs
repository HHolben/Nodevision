// Supplement the existing matrix with row CPU and actual renderer Paint for structural replay.
module.exports=async({win,js,delay})=>{
 const results=[];
 win.webContents.debugger.attach('1.3');
 const cdp=(name,args={})=>win.webContents.debugger.sendCommand(name,args);
 for(const words of [1000,10000,20000,40000])for(const fragmented of [false,true]){
  const fixture=await js(`historyPerf.configure(${words},${fragmented},'layers')`);
  for(const kind of ['insertion','structure']){
   await js(`historyPerf.prepare('${kind}')`);await delay(700);
   for(const direction of ['undo','redo']){
    await js('historyPerf.resetMetrics()');
    const events=[];let complete;const done=new Promise(r=>complete=r);
    const listener=(_event,method,args)=>{if(method==='Tracing.dataCollected')events.push(...args.value);if(method==='Tracing.tracingComplete')complete();};
    win.webContents.debugger.on('message',listener);
    await cdp('Tracing.start',{categories:'devtools.timeline,blink.user_timing',transferMode:'ReportEvents'});
    const syncMs=await js(`performance.mark('structural-start');historyPerf.history('${direction}')`);
    await delay(700);const sample=await js('historyPerf.snapshot()');
    await cdp('Tracing.end');await done;win.webContents.debugger.removeListener('message',listener);
    const start=events.find(e=>e.name==='structural-start');
    const paint=events.filter(e=>e.name==='Paint'&&e.ts>=start.ts);
    results.push({fixture,kind,direction,syncMs,...sample,paint:{count:paint.length,cpuMs:paint.reduce((n,e)=>n+(e.dur||0)/1000,0),firstMs:paint.length?(Math.min(...paint.map(e=>e.ts))-start.ts)/1000:null}});
   }
  }
  console.log('structural',words,fragmented,'complete');
 }
 await js('historyPerf.dispose()');win.webContents.debugger.detach();return {results};
};

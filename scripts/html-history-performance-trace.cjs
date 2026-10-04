// Actual renderer Paint events supplement requestAnimationFrame proxies in selected large-document configurations.
module.exports=async({win,js,type,delay,cdp})=>{
  const output=[];
  for(const config of ['editor','heavy','bare']){
    await win.loadURL(win.webContents.getURL());
    for(let i=0;i<200&&!await js('!!window.historyPerf?.ready');i++)await delay(50);
    await js(`historyPerf.configure(20000,true,'${config==='bare'?'editor':config}')`);
    if(config==='bare')await js(`(()=>{const root=historyPerf.current().editorElement;root.hidden=true;const bare=document.createElement('div');bare.id='bare-comparison';bare.style.cssText=root.style.cssText;bare.contentEditable='true';bare.innerHTML=new DOMParser().parseFromString(historyPerf.source(),'text/html').body.innerHTML;root.after(bare);bare.focus();const r=document.createRange();r.selectNodeContents(bare.querySelector('#text').firstChild);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);})()`);
    const events=[];
    let complete;const done=new Promise(resolve=>complete=resolve);
    const listener=(_event,method,args)=>{if(method==='Tracing.dataCollected')events.push(...args.value);if(method==='Tracing.tracingComplete')complete();};
    win.webContents.debugger.on('message',listener);
    await cdp('Tracing.start',{categories:'devtools.timeline,blink.user_timing',transferMode:'ReportEvents'});
    for(const letter of 'abcdefghijklmnopqrst'){win.webContents.sendInputEvent({type:'keyDown',keyCode:letter});win.webContents.sendInputEvent({type:'char',keyCode:letter});win.webContents.sendInputEvent({type:'keyUp',keyCode:letter});await delay(30);}await delay(100);
    await js('performance.mark("history-replay-start");'+(config==='bare'?'Document.prototype.execCommand.call(document,"undo")':'historyPerf.history("undo")')+';performance.mark("history-replay-end")');await delay(300);
    await cdp('Tracing.end');await done;win.webContents.debugger.removeListener('message',listener);
    const totals={},paint=events.filter(e=>e.name==='Paint').sort((a,b)=>a.ts-b.ts);
    for(const e of events)if(e.ph==='X'&&['Layout','UpdateLayoutTree','Paint','FunctionCall','EventDispatch','RunMicrotasks'].includes(e.name)){const t=totals[e.name]||={count:0,ms:0,maxMs:0};t.count++;t.ms+=(e.dur||0)/1000;t.maxMs=Math.max(t.maxMs,(e.dur||0)/1000);}
    const inputs=events.filter(e=>e.name==='EventDispatch'&&e.args?.data?.type==='beforeinput').map(e=>e.ts);
    const nativeInputs=events.filter(e=>e.name==='EventDispatch'&&e.args?.data?.type==='beforeinput').map(e=>{
      const following=events.find(next=>next.name==='EventDispatch'&&next.args?.data?.type==='input'&&next.ts>=e.ts);
      return {beforeinputMs:(e.dur||0)/1000,nativeEditGapMs:following?(following.ts-e.ts-(e.dur||0))/1000:null,inputMs:following?(following.dur||0)/1000:null};
    });
    const start=events.find(e=>e.name==='history-replay-start'),end=events.find(e=>e.name==='history-replay-end');
    const replayPaint=start?paint.filter(e=>e.ts>=start.ts):[];
    const replay={syncMs:start&&end?(end.ts-start.ts)/1000:null,firstPaintMs:replayPaint[0]?(replayPaint[0].ts-start.ts)/1000:null,secondPaintMs:replayPaint[1]?(replayPaint[1].ts-start.ts)/1000:null};
    output.push({config,totals,nativeInputs,replay,inputToPaint:inputs.map(t=>{const next=paint.filter(e=>e.ts>=t);return {first:next[0]?(next[0].ts-t)/1000:null,second:next[1]?(next[1].ts-t)/1000:null};})});
  }
  await js('document.getElementById("bare-comparison")?.remove();historyPerf.current().editorElement.hidden=false');
  return output;
};

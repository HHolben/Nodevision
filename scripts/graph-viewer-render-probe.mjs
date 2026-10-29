// Controlled renderer isolation: preset grid, production style, synthetic DOM mouse/wheel events.
export async function runRenderProbe(setupPanel,core,results) {
 const wait=ms=>new Promise(r=>setTimeout(r,ms));const frame=()=>new Promise(requestAnimationFrame);
 for(const n of [10,100,1000,5000]) {
  console.log('NV_TEST_PROGRESS','renderer',n);
  window.fetch=async()=>Response.json([]);
  const p=document.createElement('div');p.style.cssText='width:800px;height:600px';p.className='panel';document.body.append(p);window.activeCell=p;
  const life=await setupPanel(p);await wait(200);const cy=window.cy;
  core.scopeInvestigation.cancelQueuedLayout();cy.elements().remove();
  const nodes=Array.from({length:n},(_,i)=>({data:{id:`n${i}`,type:'file',fullPath:`n${i}`,label:`Node ${i}`},position:{x:(i%50)*40,y:Math.floor(i/50)*40}}));
  const edges=Array.from({length:n*(n===10?1:2)},(_,i)=>({data:{id:`e${i}`,source:`n${i%n}`,target:`n${(i%n+1+Math.floor(i/n))%n}`,edgeLabel:`Link ${i}`}}));
  cy.add([...nodes,...edges]);cy.fit();await frame();await frame();
  const renderer=cy.renderer(), originals={}, values={};
  let on=true;
  for(const key of ['render','findNearestElements','drawElements','drawCachedElements'])if(typeof renderer[key]==='function') {
   originals[key]=renderer[key];renderer[key]=function(...args){if(!on)return originals[key].apply(this,args);const start=performance.now();try{return originals[key].apply(this,args);}finally{(values[key]||=[]).push(performance.now()-start);}};
  }
  const host=cy.container();const canvas=host.querySelector('canvas');const rect=host.getBoundingClientRect();
  const mouse=(type,x,y,buttons=0)=>canvas.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,clientX:rect.left+x,clientY:rect.top+y,buttons,button:0}));
  for(const operation of ['hover','drag-pan','wheel','hover-no-probes','labels-hidden-pan']) {
   for(const k of Object.keys(values))delete values[k];window.__perf={toolbar:0,selectionRequests:0,functions:{}};let renders=0;const count=()=>renders++;cy.on('render',count);
   on=operation!=='hover-no-probes';
   if(operation==='labels-hidden-pan'){cy.style().selector('node, edge').style('label','').update();await frame();await frame();}
   const start=performance.now();const intervals=[];let last=start;
   if(operation==='drag-pan')mouse('mousedown',750,550,1);
   for(let i=0;i<60;i++){
    if(operation==='wheel')canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:rect.left+400,clientY:rect.top+300,deltaY:i%2?10:-10}));
    else if(operation==='labels-hidden-pan')cy.panBy({x:i%2?3:-3,y:0});
    else mouse('mousemove',operation==='drag-pan'?750-i:30+i*8,operation==='drag-pan'?550:100,operation==='drag-pan'?1:0);
    await frame();const now=performance.now();intervals.push(now-last);last=now;
   }
   if(operation==='drag-pan')mouse('mouseup',691,550);
   await frame();await frame();cy.off('render',count);
   const summarize=a=>({count:a.length,total:a.reduce((a,b)=>a+b,0),mean:a.reduce((a,b)=>a+b,0)/(a.length||1),max:Math.max(0,...a),p95:[...a].sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1]||0});
   results.push({operation:'renderer-'+operation,n,inputEvents:60,elapsed:performance.now()-start,frames:summarize(intervals),renders,functions:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,summarize(v)])),toolbar:window.__perf.toolbar});
  }
  for(const [k,v]of Object.entries(originals))renderer[k]=v;
  life.destroy();host.__nvGraphResizeObserver?.disconnect();cy.destroy();p.remove();core.scopeInvestigation.cancelQueuedLayout();
 }
}

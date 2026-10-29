// Follow-up isolation: time production Core wrappers during compound directory opening.
window.__perf={toolbar:0,selectionRequests:0,functions:{}};
window.__record=(name,ms)=>(window.__perf.functions[name]||=[]).push(ms);
window.NodevisionState={};
const {setupPanel}=await import('/PanelInstances/InfoPanels/GraphManager.mjs');
const core=await import('/PanelInstances/InfoPanels/GraphManagerCore.mjs');
const results=[];
try {
 for(const n of [10,100,1000]) {
  console.log('NV_TEST_PROGRESS','open-isolation',n);
  window.__perf={toolbar:0,selectionRequests:0,functions:{}};
  window.fetch=async url=>{
   if(String(url).startsWith('/api/files'))return Response.json(Array.from({length:n},(_,i)=>({name:`n${i}.txt`,isDirectory:false})));
   if(String(url)==='/public/data/edges/n.json')return Response.json(Array.from({length:n*(n===10?1:2)},(_,i)=>({source:`n${i%n}.txt`,target:`n${(i%n+1+Math.floor(i/n))%n}.txt`,label:`Link ${i}`})));
   return Response.json([]);
  };
  const panel=document.createElement('div');panel.className='panel';panel.style.cssText='width:800px;height:600px';document.body.append(panel);window.activeCell=panel;
  const start=performance.now();const life=await setupPanel(panel);const setupMs=performance.now()-start;const cy=window.cy;
  await new Promise(resolve=>cy.one('layoutstop',resolve));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  results.push({n,setupMs,totalMs:performance.now()-start,functions:structuredClone(window.__perf.functions)});
  life.destroy();cy.container().__nvGraphResizeObserver?.disconnect();cy.destroy();panel.remove();core.scopeInvestigation.cancelQueuedLayout();
 }
 document.querySelector('#result').textContent='PASS: '+JSON.stringify(results);
} catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}

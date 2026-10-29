// Browser benchmark only. Production modules and bundled renderer; synthetic transport and input.
const frame = () => new Promise(r => requestAnimationFrame(r));
const wait = ms => new Promise(r => setTimeout(r, ms));
const stats = a => { const s = [...a].sort((a,b)=>a-b); return { count:s.length, mean:s.reduce((a,b)=>a+b,0)/(s.length||1), p95:s[Math.ceil(s.length*.95)-1]||0, max:s.at(-1)||0 }; };
let enabled = true;
window.__perf = { toolbar:0, selectionRequests:0, functions:{} };
window.__record = (name, ms) => { if(enabled) (window.__perf.functions[name] ||= []).push(ms); };
window.NodevisionState = {};
window.fetch = async () => Response.json([]);
const results = [];
const longTasks = [];
new PerformanceObserver(list => longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
const {setupPanel} = await import('/PanelInstances/InfoPanels/GraphManager.mjs');
const core = await import('/PanelInstances/InfoPanels/GraphManagerCore.mjs');
function fixture(n,e) {
  const nodes = Array.from({length:n},(_,i)=>({data:{id:`n${i}.txt`,fullPath:`n${i}.txt`,label:`Node ${i}`,type:'file'},position:{x:(i%100)*45,y:Math.floor(i/100)*45}}));
  const records = Array.from({length:e},(_,i)=>({sourcePath:`n${i%n}.txt`,targetPath:`n${(i%n+1+Math.floor(i/n))%n}.txt`,label:`Link ${i}`,linkKind:'link'}));
  return {nodes,records};
}
try {
for(const repeat of [1,2]) for(const [n,e] of [[10,10],[100,200],[1000,2000],[5000,10000]]) {
  console.log('NV_TEST_PROGRESS',repeat,n);
  const panel = document.createElement('div'); panel.style.cssText='width:800px;height:600px'; panel.className='panel'; document.body.append(panel); window.activeCell=panel;
  const mountStart=performance.now(); const life=await setupPanel(panel); await wait(200); const cy=window.cy; const mountDuration=performance.now()-mountStart; core.scopeInvestigation.cancelQueuedLayout();
  const host=panel.querySelector('[data-graph-container], #cy');
  let counts={}; const event=e=>counts[e.type]=(counts[e.type]||0)+1;
  cy.on('render layoutstart layoutstop pan zoom select unselect add remove data position style tap mousemove mouseover mouseout',event);
  let mutations=0; const observer=new MutationObserver(list=>mutations+=list.length); observer.observe(panel,{subtree:true,attributes:true,childList:true});
  async function measure(operation, fn, samples=12) {
    counts={}; mutations=0; window.__perf={toolbar:0,selectionRequests:0,functions:{}};
    const durations=[], visible=[], frames=[]; let running=true,last=performance.now();
    const tick=t=>{ if(!running)return; frames.push(t-last);last=t;requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    console.log('NV_TEST_PROGRESS',repeat,n,operation);
    const start=performance.now(); performance.mark('gv-start');
    for(let i=0;i<samples;i++) {const t=performance.now(); await fn(i); durations.push(performance.now()-t); await frame();await frame(); visible.push(performance.now()-t);}
    performance.mark('gv-end');performance.measure('gv:'+operation,'gv-start','gv-end'); running=false;
    results.push({repeat,n,e,operation,elapsed:performance.now()-start,handler:stats(durations),paintOpportunity:stats(visible),frame:stats(frames),events:{...counts},domMutations:mutations,toolbar:window.__perf.toolbar,selectionRequests:window.__perf.selectionRequests,functions:Object.fromEntries(Object.entries(window.__perf.functions).map(([k,v])=>[k,stats(v)])),heap:performance.memory?.usedJSHeapSize});
  }
  const data=fixture(n,e), serialized=JSON.stringify(data); let parsed;
  await measure('parse',()=>{parsed=JSON.parse(serialized);},3);
  await measure('construct',()=>{cy.elements().remove();core.scopeInvestigation.attach(cy,parsed.records);cy.add(parsed.nodes);core.scopeInvestigation.rebuild();},1);
  core.performanceProbe.resetLayout();
  await measure('initial-layout',()=>core.performanceProbe.runRelayout({fit:true,reasons:['benchmark']}),1);
  await measure('pan',i=>cy.panBy({x:i%2?8:-8,y:3}));
  await measure('zoom',i=>cy.zoom(cy.zoom()*(i%2?1/1.05:1.05)));
  await measure('select-node',i=>cy.nodes()[i%n].emit('tap'));
  await measure('hover',i=>{const r=host.getBoundingClientRect();host.querySelector('canvas').dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.left+30+i*10,clientY:r.top+80}));},60);
  await measure('modify-label',i=>cy.nodes()[0].data('label',`Changed ${i}`));
  await measure('rebuild-edges',()=>core.scopeInvestigation.rebuild(),3);
  await measure('proof-layout',()=>core.performanceProbe.runRelayout({fit:false,reasons:['benchmark-update']}),1);
  await measure('resize',i=>{panel.style.width=`${780+i%2*20}px`;});
  await measure('tab-hide-restore',i=>{panel.hidden=i%2===0;panel.style.display=panel.hidden?'none':'flex';}); panel.hidden=false;panel.style.display='flex';
  await measure('idle',()=>wait(1000),1);
  panel.hidden=true;panel.style.display='none';await measure('hidden-update',()=>cy.nodes()[0].data('label','Hidden update'),1);await measure('hidden-idle',()=>wait(1000),1);panel.hidden=false;panel.style.display='flex';
  enabled=false;await measure('pan-instrumentation-disabled',i=>cy.panBy({x:i%2?8:-8,y:3}));enabled=true;
  life.destroy();await measure('after-destroy-resize',()=>{panel.style.width='740px';},1);
  results.push({repeat,n,e,operation:'cleanup',cyDestroyed:cy.destroyed(),observerRetained:!!host.__nvGraphResizeObserver,mountIncluding200ms:mountDuration});
  observer.disconnect();host.__nvGraphResizeObserver?.disconnect();cy.destroy();panel.remove();core.scopeInvestigation.cancelQueuedLayout();
}
await (await import('/scripts/graph-viewer-lifecycle-probe.mjs')).runLifecycle(setupPanel,core,results);
document.querySelector('#result').textContent='PASS: '+JSON.stringify({environment:{userAgent:navigator.userAgent,dpr:devicePixelRatio},results,longTasks});
} catch(error) {document.querySelector('#result').textContent='FAIL: '+error.stack;}

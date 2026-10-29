// Isolated production mount/cleanup checks. No user data or production changes.
export async function runLifecycle(setupPanel,core,results) {
 await (await import('/scripts/graph-viewer-render-probe.mjs')).runRenderProbe(setupPanel,core,results);
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const make=()=>{const p=document.createElement('div');p.className='panel';p.style.cssText='width:800px;height:600px';document.body.append(p);window.activeCell=p;return p;};
 window.fetch=async()=>Response.json([]);
 const a=make(), la=await setupPanel(a);await wait(200);const ca=window.cy;
 const b=make(), lb=await setupPanel(b);await wait(200);const cb=window.cy;
 results.push({operation:'two-viewers',distinctInstances:ca!==cb,firstDestroyed:ca.destroyed(),secondHostOwnsInstance:cb.container()===b.querySelector('[data-graph-container], #cy'),actualHostIsFirst:cb.container()===a.querySelector('[data-graph-container], #cy'),firstContainerId:ca.container()?.id});
 la.destroy();lb.destroy();
 for(const p of [a,b])p.querySelector('[data-graph-container], #cy')?.__nvGraphResizeObserver?.disconnect();
 ca.destroy();cb.destroy();a.remove();b.remove();core.scopeInvestigation.cancelQueuedLayout();
 for(const n of [10,100,1000,5000]) {
  console.log('NV_TEST_PROGRESS','production-open',n);
  let requests=0;
  window.fetch=async url=>{requests++;const path=String(url);if(path.startsWith('/api/files'))return Response.json(Array.from({length:n},(_,i)=>({name:`n${i}.txt`,isDirectory:false})));if(path==='/public/data/edges/n.json')return Response.json(Array.from({length:n*(n===10?1:2)},(_,i)=>({source:`n${i%n}.txt`,target:`n${(i%n+1+Math.floor(i/n))%n}.txt`,label:`Link ${i}`})));return Response.json([]);};
  const p=make();let t=performance.now();const l=await setupPanel(p);const setupMs=performance.now()-t;const cy=window.cy;
  let renders=0;cy.on('render',()=>renders++);
  // Startup layout is queued for 60ms. Await real layout completion, then two paint opportunities.
  await new Promise(resolve=>{cy.one('layoutstop',resolve);});
  await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  results.push({operation:'production-open',n,actualNodes:cy.nodes().length,actualEdges:cy.edges().length,setupMs,throughLayoutPaintOpportunity:performance.now()-t,requests,renders});
  l.destroy();p.querySelector('[data-graph-container], #cy')?.__nvGraphResizeObserver?.disconnect();cy.destroy();p.remove();core.scopeInvestigation.cancelQueuedLayout();
 }
}

// Paired diagnostic control: same seeded flat topology, style, initial and proof layouts on either revision.
window.__perf={toolbar:0,selectionRequests:0,functions:{}};window.__record=()=>{};window.NodevisionState={};window.fetch=async()=>Response.json([]);
const {setupPanel}=await import('/PanelInstances/InfoPanels/GraphManager.mjs');
const core=await import('/PanelInstances/InfoPanels/GraphManagerCore.mjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));const frame=()=>new Promise(requestAnimationFrame);
const originalRandom=Math.random;const results=[];
function seed(value){let state=value;Math.random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}
try {
 for(const n of [1000,5000])for(let trial=0;trial<3;trial++){
  console.log('NV_TEST_PROGRESS','layout-control',n,trial);
  const host=document.createElement('div');host.className='panel';host.style.cssText='width:800px;height:600px';document.body.append(host);window.activeCell=host;
  const life=await setupPanel(host);await wait(200);const cy=window.cy;core.scopeInvestigation.cancelQueuedLayout();
  const nodes=Array.from({length:n},(_,i)=>({data:{id:`n${i}.txt`,fullPath:`n${i}.txt`,label:`Node ${i}`,type:'file'},position:{x:(i%100)*45,y:Math.floor(i/100)*45}}));
  const records=Array.from({length:2*n},(_,i)=>({sourcePath:`n${i%n}.txt`,targetPath:`n${(i%n+1+Math.floor(i/n))%n}.txt`,label:`Link ${i}`,linkKind:'link'}));
  cy.elements().remove();core.scopeInvestigation.attach(cy,records);cy.add(nodes);core.scopeInvestigation.rebuild();core.performanceProbe.resetLayout();await frame();await frame();
  for(const operation of ['initial','proof']){
   seed(439+n+trial);const options=core.performanceProbe.buildGraphLayoutOptions({fit:operation==='initial'});
   const start=performance.now();core.performanceProbe.runRelayout({fit:operation==='initial',reasons:['seeded-control']});const ms=performance.now()-start;
   await frame();await frame();
   const positions=cy.nodes().map(node=>[node.position().x,node.position().y]);
   const checksum=positions.reduce((sum,[x,y],i)=>sum+(i+1)*(x+y),0);
   results.push({n,trial,operation,ms,quality:options.quality,randomize:options.randomize,checksum});
  }
  Math.random=originalRandom;const container=cy.container();life.destroy();container.__nvGraphResizeObserver?.disconnect();cy.destroy();host.remove();
 }
 document.querySelector('#result').textContent='PASS: '+JSON.stringify(results);
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}finally{Math.random=originalRandom;}

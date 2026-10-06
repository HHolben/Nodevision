// Nodevision/scripts/graph-semantic-production.mjs
// This fixture mounts the production Graph Manager and instruments its existing layout, abstraction, and edge-rebuild functions through the test server. Transport responses are empty synthetic Notebook data, so presentation checks cannot touch user files.
import { executePanelZoom, getPanelZoomCapabilities, getPanelZoomState } from '/panels/panelZoomCapabilities.mjs';
const ok = (value, message) => { if (!value) throw Error(message); };
export async function testProductionGraph() {
  const panel = document.createElement('div'); panel.className = 'panel'; panel.style.cssText='height:450px;width:700px'; document.body.append(panel);
  window.activeCell = panel; window.NodevisionState = { fileIsDirty:false };
  const originalFetch = window.fetch;
  let requests = 0;
  window.fetch = async () => { requests++; return new Response('[]', { headers: { 'Content-Type':'application/json' } }); };
  const { setupPanel } = await import('/PanelInstances/InfoPanels/GraphManager.mjs');
  const lifecycle = await setupPanel(panel);
  ok(getPanelZoomCapabilities(panel).semantic, 'production mount registers semantic owner');
  const cy = window.cy;
  cy.add([{data:{id:'fixture-a',parent:'Root',label:'A',type:'file'}},{data:{id:'fixture-b',label:'B',type:'file'}},{data:{id:'fixture-e',source:'fixture-a',target:'fixture-b',edgeLabel:'Reference'}}]);
  // Let initial directory rendering/layout and ResizeObserver work settle before invariants.
  await new Promise(resolve => setTimeout(resolve, 600));
  cy.$('#fixture-a').select(); cy.$('#fixture-e').select(); cy.zoom(1.4); cy.pan({x:17,y:29});
  const snapshot = () => JSON.stringify({ data:cy.elements().map(e=>e.data()), positions:cy.nodes().map(n=>n.position()), selected:cy.$(':selected').map(e=>e.id()), zoom:cy.zoom(), pan:cy.pan() });
  const before = snapshot(), notebookBefore = JSON.stringify(window.NodevisionState);
  ok(window.__graphCalls?.queueRelayout > 0 && window.__graphCalls?.rebuildVisibleEdges > 0, 'production counters observe real startup paths');
  requests = 0; window.__graphCalls = {};
  let fits = 0, layouts = 0, selectionChanges = 0;
  const fit = cy.fit, layout = cy.layout;
  cy.fit = function(...args) { fits++; return fit.apply(this,args); };
  cy.layout = function(...args) { layouts++; return layout.apply(this,args); };
  const selectionListener = () => selectionChanges++;
  window.addEventListener('nodevision-selection-changed', selectionListener);
  for(let i=0;i<100;i++) executePanelZoom(panel,'semantic',{action:'set',level:i%2?'annotations':'structure'});
  await new Promise(resolve=>setTimeout(resolve,150));
  ok(snapshot() === before, 'production topology/positions/parents/camera/selection unchanged');
  ok(!requests && !fits && !layouts && !selectionChanges && JSON.stringify(window.NodevisionState) === notebookBefore, 'production transitions have no source, network, dirty, camera or selection side effects');
  ok(Object.values(window.__graphCalls).every(n=>n===0), 'zero production layout, abstraction or edge rebuild calls');
  executePanelZoom(panel,'semantic',{action:'set',level:'structure'});
  // Refresh through the production path with synthetic file and persisted-link responses.
  window.fetch = async (url) => {
    const path = String(url);
    if (path.startsWith('/api/files')) return Response.json([{name:'A.txt',isDirectory:false},{name:'B.txt',isDirectory:false}]);
    if (path.includes('/data/edges/')) return Response.json([{source:'A.txt',target:'B.txt',label:'Refreshed reference'}]);
    if (path.startsWith('/Notebook/')) return new Response('fixture text');
    return Response.json([]);
  };
  await window.refreshGraphManager({fit:false,reason:'semantic-regression'});
  const refreshed = cy.edges().filter(edge => edge.source().id()==='A.txt' && edge.target().id()==='B.txt');
  ok(refreshed.length > 0 && refreshed[0].style('text-opacity')==='0','production rebuilt ordinary edge inherits Structure');
  executePanelZoom(panel,'semantic',{action:'reset'});
  ok(refreshed[0].style('text-opacity')!=='0','production rebuilt edge returns to Annotations');
  executePanelZoom(panel,'semantic',{action:'set',level:'structure'});
  await new Promise(resolve=>setTimeout(resolve,300));
  panel.hidden = true;
  ok(!executePanelZoom(panel,'semantic',{action:'reset'}),'production retained hidden host refuses commands');
  panel.hidden = false;
  ok(getPanelZoomState(panel,'semantic').level==='structure','retained view keeps semantic state');
  window.removeEventListener('nodevision-selection-changed',selectionListener);
  lifecycle.destroy(); ok(!getPanelZoomCapabilities(panel).semantic,'production panel destruction unregisters');
  panel.querySelector('#cy').__nvGraphResizeObserver?.disconnect(); cy.destroy(); panel.remove(); window.fetch = originalFetch;
}

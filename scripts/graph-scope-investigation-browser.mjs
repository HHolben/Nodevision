// Nodevision/scripts/graph-scope-investigation-browser.mjs
// This investigation reproduces unsafe production abstraction behavior and measures loaded-directory projection preparation separately from a naive hide/show rendering experiment. It deliberately installs no structural scope capability or user-facing aggregation feature.
import { scopeInvestigation as probe } from '/PanelInstances/InfoPanels/GraphManagerCore.mjs';
import { projectLoadedDirectories } from './graph-scope-projection-probe.mjs';
import { installGraphSemanticZoom } from '/PanelInstances/InfoPanels/GraphManagerDependencies/GraphSemanticZoom.mjs';
import { executePanelZoom, getPanelZoomState } from '/panels/panelZoomCapabilities.mjs';
const ok = (value, message) => { if (!value) throw Error(message); };
const copy = value => JSON.parse(JSON.stringify(value));
const frame = () => new Promise(resolve=>requestAnimationFrame(resolve));
function fixture(files = 4, density = 1) {
  const host = document.createElement('div'); host.style.cssText='width:650px;height:400px'; document.body.append(host);
  const elements = [{data:{id:'Root',fullPath:'',type:'directory',label:'Notebook'}}], records = [], dirs = new Set(['Root']), fileIds = [];
  const perDirectory = files===4 ? 2 : 50;
  for(let i=0;i<files;i++) {
    const dirIndex = Math.floor(i/perDirectory), project = 'P'+Math.floor(dirIndex/10), dir = project+'/D'+dirIndex, id = dir+'/f'+i+'.txt';
    for(const [path,parent] of [[project,'Root'],[dir,project]]) if(!dirs.has(path)) { dirs.add(path); elements.push({data:{id:path,fullPath:path,type:'directory',label:path,parent}}); }
    fileIds.push(id);
    elements.push({data:{id,fullPath:id,type:'file',label:'f'+i,parent:dir},position:{x:dirIndex*200+(i%perDirectory)*12,y:30+(i%7)*25}});
  }
  for(let i=0;i<files;i++) for(let j=0;j<density;j++) {
    const target = (i+(files===4?2:[7,53,151,307][j]))%files;
    const record = {id:'r'+i+'-'+j,sourcePath:fileIds[i],targetPath:fileIds[target],targetRaw:fileIds[target],recordIndex:0,linkProperty:'href',label:'reference'};
    records.push(record); elements.push({data:{id:record.id,source:record.sourcePath,target:record.targetPath,edgeLabel:'reference',linkRecords:[record]}});
  }
  const cy = cytoscape({container:host,elements,layout:{name:'preset',fit:false},style:[
    {selector:'node',style:{width:20,height:20}}, {selector:'node[type="directory"]',style:{label:'data(label)','shape':'rectangle','compound-sizing-wrt-labels':'include',padding:10}},
    {selector:'edge',style:{label:'data(edgeLabel)','font-size':8,'curve-style':'straight',width:1}}
  ]});
  return {host,cy,records,fileIds,dispose(){cy.destroy();host.remove();}};
}
const positions = cy => copy(cy.nodes().map(node=>[node.id(),node.position(),node.parent().id()]));
try {
  window.NodevisionState = {fileIsDirty:false};
  let requests = 0; window.fetch = async () => { requests++; return Response.json([]); };
  const f=fixture(); const cy=f.cy; probe.attach(cy,f.records); await frame();
  const file=f.fileIds[0], parent=cy.getElementById(file).parent().id();
  probe.selectNode(cy.getElementById(file)); const canonical=JSON.stringify(window.NodevisionState);
  cy.edges()[0].select(); const selectedEdgeId=cy.edges()[0].id();
  const depth0=[...probe.directoryIds('P0',0)], depth1=[...probe.directoryIds('P0',1)];
  ok(depth1.includes(file),'directory depth includes files; it is not directory-only aggregation');
  window.__graphCalls={};
  probe.apply({rootPath:'P0',rootType:'directory',rootNodeId:'P0',level:1},{fit:false});
  probe.cancelQueuedLayout();
  const abstraction={canonicalUnchanged:JSON.stringify(window.NodevisionState)===canonical,selected:cy.$(':selected').map(e=>e.id()),actionPath:probe.actionPath(),calls:copy(window.__graphCalls),selectedEdgeRemoved:cy.getElementById(selectedEdgeId).empty(),depth0,depth1};
  ok(abstraction.selected.includes('P0') && !abstraction.selected.includes(file),'reproduced automatic selection replacement');
  ok(abstraction.calls.queueRelayout===1 && abstraction.calls.rebuildVisibleEdges===1,'fit false still schedules layout and rebuild');
  ok(abstraction.selectedEdgeRemoved,'rendered selected edge was replaced');
  probe.clear({fit:false,relayout:false});
  const restoredSelection=cy.$(':selected').map(e=>e.id()); ok(!restoredSelection.includes(file),'clear does not restore file selection');
  probe.apply({rootPath:file,rootType:'file',rootNodeId:file,level:0},{fit:false}); probe.cancelQueuedLayout();
  const detached=cy.getElementById(file).parent().empty(); ok(detached,'link-distance scope detaches runtime parent');
  probe.clear({fit:false,relayout:false}); ok(cy.getElementById(file).parent().id()===parent,'clear restores parent identity');
  const before=positions(cy), camera={zoom:cy.zoom(),pan:copy(cy.pan())};
  cy.nodes('[type="file"]').hide();
  const sourceRepresentative=probe.sourceRepresentative(file), targetRepresentative=probe.targetRepresentative(f.fileIds[2]);
  ok(sourceRepresentative===parent && targetRepresentative===null,'expanded-directory target resolver refuses a hidden-file representative');
  probe.rebuild(); ok(cy.edges().empty(),'naive directory hide plus real rebuild drops cross-directory links');
  const coarse=positions(cy); cy.nodes('[type="file"]').show(); const after=positions(cy);
  const moved=coarse.filter((entry,index)=>JSON.stringify(entry[1])!==JSON.stringify(before[index][1]));
  ok(JSON.stringify(camera)===JSON.stringify({zoom:cy.zoom(),pan:cy.pan()}),'hide/show need not move camera');
  const geometry={changedCompoundPositions:moved,positionsRestored:JSON.stringify(before)===JSON.stringify(after)};
  const canonicalRecords=JSON.stringify(f.records), data=copy(cy.nodes().map(n=>n.data()));
  const projected=projectLoadedDirectories(data,f.records,[...f.fileIds.slice(0,2)]);
  ok(projected.selectedCounts.get(parent)===2,'identity-only projection can count hidden selections');
  ok(JSON.stringify(f.records)===canonicalRecords,'planning keeps source records unchanged');
  probe.selectNode(cy.getElementById(parent)); ok(window.NodevisionState.selectedFile===parent,'explicit aggregate selection is an existing real action');
  const release=installGraphSemanticZoom(f.host,cy);
  for(const scope of ['files','directories']) for(const detail of ['structure','annotations']) {
    if(scope==='directories') cy.nodes('[type="file"]').hide(); else cy.nodes('[type="file"]').show();
    executePanelZoom(f.host,'semantic',{action:'set',level:detail});
    ok(getPanelZoomState(f.host,'semantic').level===detail,'detail remains independent of experimental visibility');
  }
  release(); probe.detach(); f.dispose();
  console.log('NV_TEST_PROGRESS','blockers reproduced',JSON.stringify({abstraction,detached,restoredSelection,geometry,sourceRepresentative,targetRepresentative,requests}));
  const benchmarks=[];
  const chosenCase = new URL(import.meta.url).searchParams.get('case');
  for(const [size,density] of [[1000,1],[1000,4],[10000,1],[10000,4]].filter(pair=>!chosenCase || pair.join(':')===chosenCase)) {
    console.log('NV_TEST_PROGRESS','scope probe',size,density);
    const g=fixture(size,density), {cy}=g; await frame(); await frame();
    const plainNodes=copy(cy.nodes().map(n=>n.data())), source=JSON.stringify(g.records), original=positions(cy);
    cy.getElementById(g.fileIds[0]).select(); const selected=cy.$(':selected').map(e=>e.id()), camera={zoom:cy.zoom(),pan:copy(cy.pan())};
    const files=cy.nodes('[type="file"]'), nodeTimes=[],edgeTimes=[],domTimes=[],paintTimes=[],cacheTimes=[];
    let layoutCalls=0,selectionChanges=0,sourceChanges=0,maxCompoundDisplacement=0,cache=null;
    cy.on('layoutstart',()=>layoutCalls++);cy.on('select unselect',()=>selectionChanges++);cy.on('data add remove',()=>sourceChanges++);
    for(let i=0;i<100;i++) {
      const fresh=projectLoadedDirectories(plainNodes,g.records,selected);nodeTimes.push(fresh.nodeMs);edgeTimes.push(fresh.edgeMs);
      const cacheStart=performance.now();if(!cache) cache=fresh;const plan=cache;cacheTimes.push(performance.now()-cacheStart);
      ok(plan.representatives.get(g.fileIds[0])===cy.getElementById(g.fileIds[0]).parent().id(),'cached identity mapping matches loaded compound');
      const start=performance.now();cy.batch(()=>i%2?files.show():files.hide());domTimes.push(performance.now()-start);
      await frame();await frame();paintTimes.push(performance.now()-start);
      if(i===0) for(const [id,pos] of original) if(cy.getElementById(id).data('type')==='directory') { const now=cy.getElementById(id).position();maxCompoundDisplacement=Math.max(maxCompoundDisplacement,Math.hypot(now.x-pos.x,now.y-pos.y)); }
      if(i%25===24) console.log('NV_TEST_PROGRESS','transitions',size,density,i+1);
    }
    const stats=values=>{values.sort((a,b)=>a-b);return {p50Ms:+values[49].toFixed(2),p95Ms:+values[94].toFixed(2)};};
    ok(JSON.stringify(cy.$(':selected').map(e=>e.id()))===JSON.stringify(selected),'100 visibility cycles retain real selection');
    ok(JSON.stringify({zoom:cy.zoom(),pan:cy.pan()})===JSON.stringify(camera),'100 visibility cycles retain camera');
    ok(JSON.stringify(g.records)===source&&!sourceChanges&&!layoutCalls&&!selectionChanges,'probe never writes source or runs layout');
    const summary={files:size,nodes:cy.nodes().length,edges:cy.edges().length,transitions:100,nodeProjection:stats(nodeTimes),edgeProjection:stats(edgeTimes),cachedRead:stats(cacheTimes),hideShow:stats(domTimes),throughPaintOpportunity:stats(paintTimes),maxCompoundDisplacement:+maxCompoundDisplacement.toFixed(2),positionsRestored:JSON.stringify(positions(cy))===JSON.stringify(original),layoutCalls,selectionChanges,sourceChanges,cacheEntries:cache.representatives.size+cache.edges.size,projectedEdges:cache.edges.size};
    cache=null; summary.cacheReleased=cache===null; benchmarks.push(summary);console.log('NV_TEST_PROGRESS','benchmark',JSON.stringify(summary));g.dispose();
  }
  document.querySelector('#result').textContent='PASS: unsafe abstraction paths reproduced; planning/visibility probes only. '+JSON.stringify({abstraction,detached,restoredSelection,geometry,requests,benchmarks});
} catch(error) { document.querySelector('#result').textContent='FAIL: '+error.stack; }

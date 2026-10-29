// Real Chromium/Cytoscape lifecycle regression. Notebook and MQTT transport are deterministic fixtures.
const ok = (value, message) => { if (!value) throw new Error(message); };
const same = (a,b,message) => ok(JSON.stringify(a)===JSON.stringify(b),message+' '+JSON.stringify({actual:a,expected:b}));
const wait = ms => new Promise(r=>setTimeout(r,ms));
window.__perf={toolbar:0,selectionRequests:0,functions:{}};
window.__record=(name,ms)=>(window.__perf.functions[name]||=[]).push(ms);
window.NodevisionState={};
const errors=[];window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const observerSets={};
for(const name of ['ResizeObserver','MutationObserver']) {
 const Native=window[name], active=new Set();observerSets[name]=active;
 window[name]=class extends Native {
  constructor(callback){let self;super((...args)=>{self.calls++;callback(...args);});self=this;this.calls=0;}
  observe(...args){active.add(this);return super.observe(...args);}
  disconnect(){active.delete(this);return super.disconnect();}
 };
}
// Count actual window/document listeners, including automatic once removal.
const originalAdd=EventTarget.prototype.addEventListener,originalRemove=EventTarget.prototype.removeEventListener;
const listeners=[];
EventTarget.prototype.addEventListener=function(type,listener,options){
 if((this!==window&&this!==document)||!listener)return originalAdd.call(this,type,listener,options);
 const capture=typeof options==='boolean'?options:!!options?.capture;
 if(listeners.some(x=>x.target===this&&x.type===type&&x.listener===listener&&x.capture===capture))return;
 const entry={target:this,type,listener,capture,wrapped:null};
 entry.wrapped=function(event){if(options?.once){const i=listeners.indexOf(entry);if(i>=0)listeners.splice(i,1);}return typeof listener==='function'?listener.call(this,event):listener.handleEvent(event);};
 listeners.push(entry);return originalAdd.call(this,type,entry.wrapped,options);
};
EventTarget.prototype.removeEventListener=function(type,listener,options){
 const capture=typeof options==='boolean'?options:!!options?.capture;
 const i=listeners.findIndex(x=>x.target===this&&x.type===type&&x.listener===listener&&x.capture===capture);
 if(i<0)return originalRemove.call(this,type,listener,options);
 const [entry]=listeners.splice(i,1);return originalRemove.call(this,type,entry.wrapped,options);
};
let files=Array.from({length:10},(_,i)=>({name:`n${i}.txt`,isDirectory:false}));
const respond=async url=>String(url).startsWith('/api/files')?Response.json(files):Response.json([]);
window.fetch=respond;
const checks=[];
try {
 const {setupPanel}=await import('/PanelInstances/InfoPanels/GraphManager.mjs');
 const {graphManagerForId}=await import('/PanelInstances/InfoPanels/GraphManagerDependencies/GraphManagerInstances.mjs');
 const {executePanelZoom,getPanelZoomCapabilities,getPanelZoomState}=await import('/panels/panelZoomCapabilities.mjs');
 const lifecycle=await import('/panels/panelContentLifecycle.mjs');
 const tabs=await import('/panels/panelTabs.mjs');
 const make=()=>{const host=document.createElement('div');host.className='panel';host.style.cssText='width:700px;height:450px';document.body.append(host);window.activeCell=host;return host;};
 const mount=async()=>{const host=make();const life=await setupPanel(host);host.style.height='450px';await wait(150);ok(life.graph&&!life.graph.destroyed(),'mounted renderer');return{host,life,cy:life.graph,id:life.instance.id};};
 const snapshot=f=>({camera:{pan:f.cy.pan(),zoom:f.cy.zoom()},selected:f.cy.$(':selected').map(n=>n.id()),data:f.cy.elements().map(n=>n.data()),inspector:f.host.querySelector('[data-graph-link-inspector]').innerHTML});
 const resources=()=>({resize:observerSets.ResizeObserver.size,mutation:observerSets.MutationObserver.size,listeners:listeners.length,mqtt:window.__mqtt.count()});
 const close=async f=>{const observer=f.host.querySelector('[data-graph-container]').__nvGraphResizeObserver;const calls=observer.calls;const id=f.id;const instance=f.life.instance;f.life.destroy();f.life.destroy();f.host.style.width='500px';window.dispatchEvent(new Event('resize'));await wait(50);
  ok(f.cy.destroyed(),'renderer destroyed');ok(observer.calls===calls,'disposed observer stayed quiet');ok(!graphManagerForId(id),'registry entry removed');
  const state=instance.__performanceProbe.resources();same(state,{disposed:true,root:false,container:false,cy:false,observer:false,listeners:0,layoutTimer:false,resizeFrame:false,collisionFrame:false,layers:false,cacheEntries:0},'owned resources released');
  ok(!getPanelZoomCapabilities(f.host).semantic,'zoom owner removed');f.host.remove();};
 // Warm imported singleton infrastructure, then require per-instance resources to return to this baseline.
 const warm=await mount();await close(warm);
 const warmCell=make();warmCell.classList.add('panel-cell');
 const warmTab=await tabs.openPanelTabInCell(warmCell,{panelType:'GraphManager'},setupPanel);await wait(150);
 tabs.closePanelTab(warmCell,warmTab.tabId,{force:true});warmCell.remove();await wait(150);
 const baseline=resources();
 const a=await mount(), b=await mount();
 const controls=document.createElement('div');controls.dataset.graphManagerLayerControls='true';document.body.append(controls);
 ok(a.cy!==b.cy&&a.cy.container()!==b.cy.container(),'distinct renderers and containers');ok(a.cy.container()===a.host.querySelector('[data-graph-container]'),'A owns A');ok(b.cy.container()===b.host.querySelector('[data-graph-container]'),'B owns B');ok(!a.cy.destroyed()&&!b.cy.destroyed(),'both alive');checks.push('A independent initialization');
 window.activeCell=a.host;a.life.activate();window.setGraphManagerExternalLinkedFilesVisible(false);ok(!a.life.instance.getGraphManagerExternalLinkedFilesVisible()&&b.life.instance.getGraphManagerExternalLinkedFilesVisible(),'shared command targets A');
 window.activeCell=b.host;b.life.activate();window.setGraphManagerExternalLinkedFilesVisible(false);ok(!b.life.instance.getGraphManagerExternalLinkedFilesVisible(),'shared command targets B');
 a.life.instance.bindGraphManagerLayerControls(null);ok(controls.querySelector('[data-mqtt-layer-controls]')&&controls.querySelector('[data-td-layer-controls]'),'former owner cannot remove active layer controls');
 const other=make();window.activeCell=other;ok(window.cy===null,'non-graph context has no global graph');ok(window.setGraphManagerExternalLinkedFilesVisible(true)===false,'non-graph context rejects graph command');
 const navigatorId=window.getGraphManagerNavigationInstanceId();ok(navigatorId===b.id,'cross-panel navigation remembers visible B');
 await wait(150); // Settle the earlier visibility-toggle layouts before measuring navigation isolation.
 const beforeNavigateA=snapshot(a);await window.revealPathInGraphManager('n2.txt',{instanceId:navigatorId,selectFile:false});await wait(150);
 ok(b.cy.$('#n2.txt').selected(),'explicit navigator receives reveal');same(snapshot(a),beforeNavigateA,'explicit navigation preserves A');ok(window.cy===null,'explicit navigation does not steal editor focus');other.remove();await wait(150);
 window.activeCell=a.host;a.life.activate();await Promise.race([window.handleGraphManagerAction('phase1Refresh'),wait(2000).then(()=>{if(!window.__fileActionCompleted)throw Error('file callback refresh deadlock');})]);ok(window.__fileActionCompleted,'generic file callback can await graph refresh');await wait(150);const beforeB=snapshot(b);a.cy.pan({x:11,y:23});a.cy.zoom(1.2);a.cy.$('#n1.txt').emit('tap');
 a.cy.add({data:{id:'e',source:'n1.txt',target:'n2.txt',label:'A link'}});a.cy.$('#e').emit('tap');
 same(snapshot(b),beforeB,'interactions preserve B local state');ok(window.selectedGraphLink?.graphInstanceId===a.id,'shared link includes origin');ok(window.NodevisionState.selectedFile==='n1.txt','intentional shared file selection');
 executePanelZoom(a.host,'semantic',{action:'set',level:'structure'});ok(getPanelZoomState(a.host,'semantic').level==='structure'&&getPanelZoomState(b.host,'semantic').level==='annotations','independent semantic zoom');
 executePanelZoom(a.host,'geometric',{action:'zoom',factor:1.1});same(snapshot(b),beforeB,'independent geometric zoom');checks.push('B routing and C interaction');
 let layouts=0,adds=0,renders=0;a.cy.on('layoutstart',()=>layouts++);a.cy.on('add remove',()=>adds++);a.cy.on('render',()=>renders++);
 const beforeHide=snapshot(a);a.life.deactivate();a.host.hidden=true;a.host.style.display='none';await wait(100);const beforeRestore={layouts,adds};a.host.hidden=false;a.host.style.display='flex';window.activeCell=a.host;a.life.activate();await wait(150);
 same(snapshot(a),beforeHide,'unchanged restore preserves camera, selection, topology and inspector');same({layouts,adds},beforeRestore,'unchanged restore no layout or reconstruction');
 a.life.deactivate();a.host.hidden=true;a.host.style.display='none';await wait(80);const hiddenRenders=renders;
 window.__mqtt.publish({topics:[{topic:'room/temp',device:'sensor',payloadPreview:'22'}],devices:[]});await wait(100);ok(renders===hiddenRenders,'hidden MQTT does not render');ok(a.cy.nodes('[source="mqtt"]').length===0,'hidden snapshot queued');
 a.host.hidden=false;a.host.style.display='flex';window.activeCell=a.host;a.life.activate();await wait(180);ok(a.cy.nodes('[source="mqtt"]').length>0,'hidden update presented on restore');checks.push('F retained hidden lifecycle and live update');
 a.life.deactivate();a.host.hidden=true;a.host.style.display='none';window.activeCell=b.host;
 files.push({name:'changed.txt',isDirectory:false});await window.refreshGraphManager({fit:false});ok(a.cy.getElementById('changed.txt').empty(),'hidden document invalidation deferred');
 a.host.hidden=false;a.host.style.display='flex';window.activeCell=a.host;a.life.activate();await wait(250);ok(!a.cy.getElementById('changed.txt').empty(),'hidden document change reconciled on activation');files.pop();
 window.activeCell=b.host;await close(b);ok(!a.cy.destroyed(),'closing B preserves A');ok(window.cy!==b.cy,'globals never return destroyed B');window.activeCell=a.host;ok(window.cy===a.cy,'A remains routable');
 await close(a);ok(!controls.children.length,'layer controls released');controls.remove();window.__mqtt.publish({topics:[],devices:[]});await wait(80);same(resources(),baseline,'A/B cleanup baseline');checks.push('D complete cleanup');
 for(let i=0;i<100;i++) {const f=await mount();let renders=0;f.cy.on('render',()=>renders++);await close(f);const stopped=renders;window.__mqtt.publish({topics:[],devices:[]});await wait(5);ok(renders===stopped,'no renderer activity after close');same(resources(),baseline,`cycle ${i+1} resources return to baseline`);if(i%20===0)console.log('NV_TEST_PROGRESS','lifecycle cycles',i+1);}
 checks.push('E 100 open/close cycles');
 // Close during an abort-ignoring style fetch. The response cannot create a renderer afterward.
 let release;window.fetch=url=>String(url).includes('GraphStyles')?new Promise(r=>release=()=>r(Response.json([]))):respond(url);
 const pendingHost=make();const pendingMount=setupPanel(pendingHost);await wait(10);const pendingInstance=pendingHost.__nvGraphManager;ok(release,'delayed initial styles requested');lifecycle.destroyPanelContentLifecycle(pendingHost);release();await pendingMount;ok(pendingInstance.destroyed&&!pendingInstance.graph,'late initialization rejected');pendingHost.remove();window.fetch=respond;
 // Close during a real tab's async directory mount, exercising panelTabs completion handling.
 let releaseDirectory;window.fetch=url=>String(url).startsWith('/api/files')?new Promise(r=>releaseDirectory=()=>r(Response.json(files))):respond(url);
 const cell=make();cell.classList.add('panel-cell');const opening=tabs.openPanelTabInCell(cell,{panelType:'GraphManager'},setupPanel);await wait(30);ok(releaseDirectory,'directory mount paused');const tab=cell.__nvPanelTabs.tabs[0];const pendingCy=tab.contentElement.__nvGraphManager.graph;tabs.closePanelTab(cell,tab.tabId,{force:true});releaseDirectory();await opening;ok(pendingCy.destroyed(),'tab closes pending graph');ok((cell.__nvPanelTabs?.tabs.length||0)===0,'late mount does not resurrect closed tab');cell.remove();window.fetch=respond;await wait(100);
 checks.push('late style/directory responses and real tab close during mount');
 // The actual TD adapter must discard a response even if transport ignores AbortSignal.
 let releaseTd;files=[{name:'sensor.td.json',isDirectory:false}];
 window.fetch=url=>String(url).startsWith('/Notebook/')?new Promise(r=>releaseTd=()=>r(Response.json({id:'urn:test:sensor',title:'Sensor',properties:{temperature:{type:'number'}}}))):respond(url);
 const td=await mount();ok(releaseTd,'TD derivation in flight');await close(td);releaseTd();await wait(100);same(resources(),baseline,'late TD response leaves no resources');window.fetch=respond;
 checks.push('late TD response after disposal');
 // A delayed broken-link read must not save or publish selection after its owner closes.
 const {retargetGraphLinkRecord}=await import('/PanelInstances/InfoPanels/GraphManagerDependencies/BrokenLinkPlaceholders.mjs');
 let current=true,releaseLink,linkRequests=0,linkPublications=0;
 window.fetch=()=>{linkRequests++;return new Promise(resolve=>releaseLink=()=>resolve(Response.json({content:'[old](old.txt)'})));};
 const retarget=retargetGraphLinkRecord({sourcePath:'source.md',editableTarget:true},'new.txt',{
  isCurrent:()=>current,publishSelection:()=>linkPublications++
 });
 await wait(10);ok(releaseLink,'link read in flight');current=false;releaseLink();
 const retargetResult=await retarget;ok(retargetResult.cancelled&&linkRequests===1&&linkPublications===0,'closed link owner cannot save or publish');window.fetch=respond;
 checks.push('late retarget read cannot persist or publish after disposal');
 // Real tab manager and real context routing: switching must retain each graph.
 files=Array.from({length:10},(_,i)=>({name:`n${i}.txt`,isDirectory:false}));
 const tabCell=make();tabCell.classList.add('panel-cell');
 const ta=await tabs.openPanelTabInCell(tabCell,{panelType:'GraphManager',allowDuplicate:true},setupPanel);await wait(150);
 const ia=ta.contentElement.__nvGraphManager;ia.graph.pan({x:13,y:27});ia.graph.zoom(1.3);const cameraA={pan:ia.graph.pan(),zoom:ia.graph.zoom()};
 const tb=await tabs.openPanelTabInCell(tabCell,{panelType:'GraphManager',allowDuplicate:true},setupPanel);await wait(150);
 const ib=tb.contentElement.__nvGraphManager;ok(ia.inactive&&!ia.graph.destroyed()&&window.cy===ib.graph,'real tabs deactivate and route B');
 tabs.activatePanelTab(tabCell,ta.tabId);await wait(100);same({pan:ia.graph.pan(),zoom:ia.graph.zoom()},cameraA,'real tab restore preserves camera');ok(window.cy===ia.graph,'real tab restore routes A');
 tabs.closePanelTab(tabCell,tb.tabId,{force:true});ok(!ia.graph.destroyed(),'closing inactive tab preserves active renderer');
 tabs.closePanelTab(tabCell,ta.tabId,{force:true});tabCell.remove();await wait(100);same(resources(),baseline,'real tab lifecycle returns resource baseline');
 for(let i=0;i<10;i++) {
  const cell=make();cell.classList.add('panel-cell');const tab=await tabs.openPanelTabInCell(cell,{panelType:'GraphManager'},setupPanel);await wait(100);
  const instance=tab.contentElement.__nvGraphManager,graph=instance.graph;
  tabs.closePanelTab(cell,tab.tabId,{force:true});cell.remove();await wait(50);
  ok(graph.destroyed()&&instance.destroyed,'real tab graph destroyed');same(resources(),baseline,'real tab resource counts remain stable');
 }
 checks.push('real tab switch/restore/close and context routing; 10 additional real-tab cycles');
 ok(!errors.length,'no unhandled rejections: '+errors.join(';'));
 document.querySelector('#result').textContent='PASS: '+JSON.stringify({checks,baseline,final:resources(),cycles:100,unhandledRejections:errors});
} catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}

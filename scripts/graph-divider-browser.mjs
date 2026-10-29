window.__perf={toolbar:0,selectionRequests:0,functions:{}};
window.__record=(name,ms)=>(window.__perf.functions[name]||=[]).push(ms);
window.NodevisionState={};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const originalFetch=window.fetch.bind(window);
window.fetch=async (url,opts)=>{
 if(String(url).startsWith('/api/files')) return Response.json([{name:'a.txt',isDirectory:false},{name:'b.txt',isDirectory:false}]);
 if(String(url).startsWith('/api/') || String(url).startsWith('/public/data/')) return Response.json([]);
 return originalFetch(url,opts);
};
try {
 await import('/panels/workspace.mjs');
 const toolbar=document.createElement('div');toolbar.id='global-toolbar';document.body.prepend(toolbar);
 const {setupPanel}=await import('/PanelInstances/InfoPanels/GraphManager.mjs');
 const tabs=await import('/panels/panelTabs.mjs');
 const {rebuildLayoutDividersForContainer}=await import('/panels/workspaceParts/workspaceDividers.mjs');
 const {installWorkspaceLayoutCollapse}=await import('/panels/workspaceLayoutCollapseIntegration.mjs');
 const workspace=document.querySelector('#workspace');workspace.style.cssText='display:flex;width:1000px;height:650px';
 const row=document.createElement('div');row.className='panel-row';row.style.cssText='display:flex;width:100%;height:100%';workspace.append(row);
 const left=document.createElement('div'),right=document.createElement('div');
 for(const cell of [left,right]){cell.className='panel-cell';cell.style.cssText='flex:1 1 0;min-width:0;min-height:0';row.append(cell);}
 window.activeCell=left;
 await tabs.openPanelTabInCell(left,{panelType:'FileManager'},async host=>{host.textContent='Files';});
 const graphTab=await tabs.openPanelTabInCell(left,{panelType:'GraphManager'},setupPanel);
 rebuildLayoutDividersForContainer(row);installWorkspaceLayoutCollapse(workspace);
 const divider=row.querySelector('.layout-divider');
 // Synthetic pointers cannot own browser pointer capture.
 divider.setPointerCapture=()=>{};divider.releasePointerCapture=()=>{};
 await wait(400);console.log('NV_TEST_PROGRESS','graph mounted before divider');
 const rect=divider.getBoundingClientRect();
 const pointer=(type,x,target=divider)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:9,button:0,clientX:x,clientY:rect.y+100}));
 pointer('pointerdown',rect.x+5);
 console.log('NV_TEST_PROGRESS','divider pressed');
 for(let i=0;i<20;i++){pointer('pointermove',rect.x+5+i*5,document);await wait(20);}
 pointer('pointerup',rect.x+100,document);await wait(500);
 console.log('NV_TEST_PROGRESS','divider released');
 if(row.querySelector('.panel-resize-placeholder'))throw Error('Resize placeholder stranded');
 tabs.closePanelTabsInCell(left,{force:true});
 document.querySelector('#result').textContent='PASS: Graph divider remains responsive';
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}

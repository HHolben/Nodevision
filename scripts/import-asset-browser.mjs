// Nodevision/scripts/import-asset-browser.mjs
// Regression checks cover immediate overlay display, shallow browsing, stale requests, safe errors, pagination and the existing import operation.
import {openImportAssetPanel} from '/ToolbarJSONfiles/importAssetWidget.mjs';
let count=0;const check=(value,message)=>{if(!value)throw Error(message);count++;};
const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out');};
try {
  window.NodevisionState={selectedFile:'worlds/report.html'};let requests=[],imports=[],refreshes=0;
  window.VRWorldContext={currentWorldPath:'worlds/report.html',loadWorldFromFile:async()=>refreshes++};
  window.fetch=(url,options={})=>{
    if(url==='/api/meta-world/import-asset'){imports.push(JSON.parse(options.body));return Promise.resolve(new Response(JSON.stringify({success:true,assetPath:imports.at(-1).assetPath})));}
    check(String(url).startsWith('/api/files?path='),'Only File Manager folder API used');
    return new Promise(resolve=>requests.push({url,options,resolve:data=>resolve(new Response(JSON.stringify(data))),fail:()=>resolve(new Response(JSON.stringify({error:'<img src=x onerror=alert(1)>'}),{status:500}))}));
  };
  const panel=await openImportAssetPanel(),root=panel.content;
  check(panel.panel.isConnected && panel.panel.dataset.layout==='overlay','Overlay opens while listing is unresolved');
  check(requests.length===1 && requests[0].url.endsWith('worlds'),'Starts in selected world folder without recursive scan');
  check(root.textContent.includes('Loading folder'),'Visible loading feedback');
  await openImportAssetPanel();check(requests.length===1,'Repeated opening reuses overlay');
  requests[0].resolve([{name:'assets',path:'worlds/assets',isDirectory:true},{name:'ignore.txt',path:'worlds/ignore.txt',isDirectory:false}]);
  await wait(()=>root.textContent.includes('📁 assets'));
  check(!root.textContent.includes('ignore.txt'),'Unsupported files filtered');
  const button=text=>[...root.querySelectorAll('button')].find(b=>b.textContent===text);
  button('📁 assets').click();check(requests.length===2 && requests[1].url.endsWith('worlds%2Fassets'),'Folder opens on demand');
  button('Notebook').click();check(requests[1].options.signal.aborted,'Superseded listing aborted');
  requests[2].resolve(Array.from({length:130},(_,i)=>({name:`asset ${i}.glb`,path:`asset ${i}.glb`,isDirectory:false})));
  await wait(()=>root.querySelectorAll('article').length===60);
  requests[1].resolve([{name:'stale.png',path:'stale.png',isDirectory:false}]);await new Promise(r=>setTimeout(r,0));check(!root.textContent.includes('stale.png'),'Late replies cannot replace newer folder');
  button('Show more').click();check(root.querySelectorAll('article').length===120,'Large folder cards rendered in pages');
  const search=root.querySelector('input[type=search]');search.value='asset 129';search.dispatchEvent(new Event('input'));check(root.querySelectorAll('article').length===1,'Local folder filtering covers unloaded pages');
  root.querySelector('[value="camera-target"]').click();button('Import to World').click();await wait(()=>imports.length===1 && refreshes===1);
  check(imports[0].assetPath==='asset 129.glb' && imports[0].worldPath==='worlds/report.html' && imports[0].placement==='camera-target','Existing import preserves selected asset, world and placement');
  window.VRWorldContext.currentWorldPath='another.html';await wait(()=>!button('Import to World').disabled);button('Import to World').click();await wait(()=>imports.length===2);check(imports[1].worldPath==='worlds/report.html','Overlay target remains stable after focus changes');
  button('Refresh').click();requests.at(-1).fail();await wait(()=>root.textContent.includes('<img src=x'));check(!root.querySelector('img'),'API errors render as text');
  button('Refresh').click();const pending=requests.at(-1);root.cleanup();panel.panel.remove();check(pending.options.signal.aborted,'Closing aborts pending listing');pending.resolve([]);
  document.getElementById('result').textContent=`PASS: ${count} asset browser checks`;
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}

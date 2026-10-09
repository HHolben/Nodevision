// Nodevision/scripts/png-analysis-browser.mjs
// This browser regression exercises PNG analysis with decoded source pixels, actual SVG line placement, workers, transformed pointer coordinates, and the real floating panel factory.
import toggleAnalysisTools from '/ToolbarCallbacks/view/AnalysisTools.mjs';
import { getActiveAnalysisTools } from '/RasterAnalysis/AnalysisToolsContext.mjs';
import { checkPngEditorAnalysis } from './png-editor-analysis-browser.mjs';
import { renderFile } from '/PanelInstances/ViewPanels/FileViewers/ViewPNG.mjs';
import { installPngAnalysisTools } from '/RasterAnalysis/PngAnalysisTools.mjs';
const ok = (value, message) => { if (!value) throw Error(message); };
const tick = () => new Promise(resolve => requestAnimationFrame(resolve));
async function wait(check) { for(let i=0;i<300;i++) { if(check()) return; await new Promise(r=>setTimeout(r,20)); } throw Error('Timed out: '+check); }
try {
  window.NodevisionState = {};
  const host=document.createElement('div');host.style.cssText='position:relative;width:600px;height:450px';document.body.append(host);
  await renderFile('fixture.png',host,null,'/Notebook');
  const viewport=host.__nvImageViewport,img=viewport.image,dispose=host._dispose;await img.decode();await tick();const source=img.src;
  host.classList.add('panel');window.activeCell=host;
  const menu=host.querySelector('[data-png-analysis]');ok(menu.hidden && menu.getClientRects().length===0,'viewer toolbar hidden initially');
  ok(!host.querySelector('summary'),'no inline dropdown');
  const viewMenu=document.createElement('div');document.body.append(viewMenu);const toggle=document.createElement('button');toggle.onclick=toggleAnalysisTools;viewMenu.append(toggle);
  const config=await (await fetch('/ToolbarJSONfiles/viewToolbar.json')).json();
  ok(config.some(item=>item.ToolbarCategory==='View'&&item.heading==='Analysis Tools'&&item.callbackKey==='AnalysisTools'&&!item.script&&item.preventAutoSubToolbar),'View menu registration');
  toggle.click();ok(!menu.hidden,'View button opens toolbar');await tick();
  const click=label=>[...menu.querySelectorAll('button')].find(b=>b.textContent===label).click();
  const svg=host.querySelector('[data-png-analysis-overlay]');
  function vertex(x,y) { const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());svg.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y,button:0})); }
  function region(label,points,close=false) { click(label); points.forEach(p=>vertex(...p)); if(close) vertex(...points[0]);else host.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})); }
  click('Region');vertex(10,10);vertex(30,10);toggle.click();
  ok(menu.hidden&&svg.style.pointerEvents==='none'&&!svg.querySelector('line'),'hiding toolbar cancels drawing');
  toggle.click();ok(host.querySelectorAll('[data-png-analysis]').length===1,'reopening reuses toolbar');
  const results=()=>document.querySelector('[data-instance-name="PngAnalysis"]');
  region('Region',[[0,0],[100,0],[100,100],[0,100]]);
  await wait(()=>results()?.textContent.includes('Current selection: 10000 pixels'));
  ok(results().classList.contains('floating'),'real undocked results');ok(results().textContent.includes('RGB(128, 0, 128)'),'average color');
  viewport.state.angle=37;viewport.command({zoom:2,panX:30,panY:-12});await tick();
  region('Subtract polygon',[[0,0],[50,0],[50,100],[0,100]],true);
  await wait(()=>results()?.textContent.includes('Current selection: 5000 pixels'));
  ok(results().textContent.includes('RGB(0, 0, 255)'),'rotated subtraction samples original pixels');ok(results().textContent.includes('50.00%'),'secondary percentage');
  region('Add polygon',[[0,0],[50,0],[50,100],[0,100]]);
  await wait(()=>results()?.textContent.includes('Current selection: 10000 pixels'));
  ok(results().textContent.includes('Combined secondary coverage of original: 50.00%'),'overlap counted once');
  click('Undo region');await wait(()=>results()?.textContent.includes('Current selection: 5000 pixels'));
  click('Add polygon');vertex(20,20);host.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  ok(svg.querySelectorAll('line').length===0,'cancel removes draft segments');ok(svg.style.pointerEvents==='none','cancel returns viewer interaction');
  results().remove();click('Show results');await wait(()=>results()?.textContent.includes('Current selection: 5000 pixels'));
  const second=document.createElement('div');second.style.cssText='width:300px;height:250px';document.body.append(second);
  await renderFile('fixture.png',second,null,'/Notebook');await second.__nvImageViewport.image.decode();
  ok(second.querySelector('[data-png-analysis-overlay] g').children.length===0,'second viewer has independent regions');
  second.classList.add('panel');window.activeCell=second;toggle.click();
  ok(!second.querySelector('[data-png-analysis]').hidden&&!menu.hidden,'View command targets active viewer');
  window.activeCell=host;second._dispose();second.remove();ok(results()?.isConnected,'disposing another viewer keeps results');
  click('Clear');ok(results().textContent.includes('Draw a region'),'clear statistics');
  ok(!svg.querySelector('mask'),'clear removes Boolean mask');
  region('Region',[[10,10],[40,10],[40,40],[10,40]]);dispose();viewport && host._dispose();
  await tick();ok(!results()&&!host.querySelector('[data-png-analysis-overlay]'),'dispose removes paths and floating results');ok(img.src===source,'source untouched');
  await renderFile('fixture.png',host,null,'/Notebook');await host.__nvImageViewport.image.decode();
  ok(host.querySelectorAll('[data-png-analysis]').length===1&&host.querySelector('[data-png-analysis]').hidden,'file reload resets toolbar visibility');
  // Closing a viewer while its factory import is pending must not leave an orphan panel.
  let releasePanel;const pendingPanel=document.createElement('div');
  const disposePending=installPngAnalysisTools(host,host.__nvImageViewport,'pending.png',()=>new Promise(resolve=>{releasePanel=()=>resolve({panel:pendingPanel});}));
  [...host.querySelectorAll('button')].filter(b=>b.textContent==='Show results').at(-1).click();
  disposePending();releasePanel();await tick();ok(!pendingPanel.isConnected,'pending panel cancelled on disposal');
  host._dispose();host.remove();viewMenu.remove();window.activeCell=null;window.__nvActivePanelElement=null;ok(!getActiveAnalysisTools(),'disposed toolbar unavailable');await checkPngEditorAnalysis();document.querySelector('#result').textContent='PASS: PNG editor live pixels, history, zoom, cleanup; PNG polygons, Boolean color/area statistics, transformed drawing, floating panel, cancellation, undo, clear, and cleanup';
} catch(error) {document.querySelector('#result').textContent='FAIL: '+error.stack;}

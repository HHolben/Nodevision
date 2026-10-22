// Nodevision/scripts/png-analysis-smoke-browser.mjs
// Checks decoded PNG statistics through the current shared-toolbar mounting contract.
import {renderFile} from '/PanelInstances/ViewPanels/FileViewers/ViewPNG.mjs';
import {getActiveAnalysisTools} from '/RasterAnalysis/AnalysisToolsContext.mjs';
const ok=(v,m)=>{if(!v)throw Error(m);};
const wait=async fn=>{for(let i=0;i<300;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Analysis results timed out');};
try{
 window.NodevisionState={};const host=document.createElement('div');host.className='panel';host.style.cssText='position:relative;width:600px;height:450px';document.body.append(host);window.activeCell=host;
 await renderFile('fixture.png',host,null,'/Notebook');await host.__nvImageViewport.image.decode();await new Promise(requestAnimationFrame);
 const tools=getActiveAnalysisTools(),bar=document.createElement('div');document.body.append(bar);ok(tools,'real viewer registers analysis');const release=tools.mount(bar);ok(bar.querySelector('[data-png-analysis]'),'shared toolbar mounts analysis controls');
 const svg=host.querySelector('[data-png-analysis-overlay]');const click=label=>[...bar.querySelectorAll('button')].find(b=>b.textContent===label).click();
 click('Region');for(const [x,y] of [[0,0],[100,0],[100,100],[0,100]]){const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());svg.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y,button:0}));}host.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 const result=()=>document.querySelector('[data-instance-name="PngAnalysis"]');await wait(()=>result()?.textContent.includes('Current selection: 10000 pixels'));ok(result().textContent.includes('RGB(128, 0, 128)'),'analysis computes original red/blue pixels');
 click('Clear');ok(result().textContent.includes('Draw a region'),'clear resets analysis');release();host._dispose();ok(!host.querySelector('[data-png-analysis-overlay]')&&!result(),'cleanup removes overlay/results');host.remove();bar.remove();document.querySelector('#result').textContent='PASS: PNG analysis toolbar mounting, decoded color/area statistics, clear and disposal';
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}

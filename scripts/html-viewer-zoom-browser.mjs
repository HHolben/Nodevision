// Nodevision/scripts/html-viewer-zoom-browser.mjs
// This regression measures real HTML reflow separately from geometric magnification and checks that every gesture keeps the page visible, source intact, selection stable, and document lifecycle ownership isolated.
import { checkFramePointerZoom } from './frame-pointer-zoom-browser.mjs';
import { renderFile } from '/PanelInstances/ViewPanels/FileViewers/ViewHTML.mjs';
import { executePanelZoom, getPanelZoomState, getPanelZoomCapabilities, setPanelZoomMode } from '/panels/panelZoomCapabilities.mjs';
import { appendPanelZoomModeControls } from '/ToolbarJSONfiles/panelZoomModesWidget.mjs';
export async function checkHtmlViewerZoom({ panel, wheel, tick, ok }, timings) {
  const host=panel(), other=panel();window.activeCell=host;const iframe=document.createElement('iframe');
  async function load(html,path='zoom.html') {
    const loaded=new Promise(resolve=>{const ready=()=>{if(!iframe.contentDocument?.querySelector(path==='zoom.html'?'#title':'#replacement'))return;iframe.removeEventListener('load',ready);resolve();};iframe.addEventListener('load',ready);});
    await renderFile(path,host,iframe,'/Notebook',{liveContent:{content:html}});await loaded;await tick();await tick();
  }
  await load('<h1 id="title">Zoom document</h1><p id="reading" style="font:16px/20px sans-serif">'+('Text should wrap when reading zoom increases. '.repeat(30))+'</p><form><button type="button">Ordinary button</button></form>'+Array.from({length:2000},(_,i)=>`<section id="region-${i}" style="height:30px">Region ${i}</section>`).join(''));
  const doc=iframe.contentDocument, frame=iframe.contentWindow, paragraph=doc.querySelector('#reading');
  const source=doc.documentElement.outerHTML, state=JSON.stringify(window.NodevisionState);
  const selection=frame.getSelection(), range=doc.createRange();range.selectNodeContents(doc.querySelector('#title'));selection.removeAllRanges();selection.addRange(range);
  const selected=selection.anchorNode, selectedText=selection.toString();iframe.focus();
  let mutations=0, loads=0;const observer=new MutationObserver(records=>mutations+=records.length);
  observer.observe(doc.documentElement,{subtree:true,attributes:true,childList:true,characterData:true});iframe.addEventListener('load',()=>loads++);
  const visible=()=>getComputedStyle(iframe).display!=='none' && iframe.getBoundingClientRect().height>0 && !host.querySelector('[data-nv-html-outline]');
  const visualTextSize=()=>Number.parseFloat(frame.getComputedStyle(paragraph).fontSize)*iframe.getBoundingClientRect().width/iframe.offsetWidth;
  const baseline={width:frame.innerWidth,height:paragraph.offsetHeight,text:visualTextSize(),frameWidth:iframe.getBoundingClientRect().width};
  ok(getPanelZoomCapabilities(host).semantic && getPanelZoomCapabilities(host).geometric && !getPanelZoomCapabilities(host).fisheye,'HTML has two independent modes');
  // Small wheel deltas must not be swallowed by the discrete Graph semantic accumulator.
  wheel(doc.body,{altKey:false,deltaY:-10});ok(getPanelZoomState(host,'semantic').zoom>1,'small Ctrl wheel reflows immediately');
  executePanelZoom(host,'semantic',{action:'set',zoom:2});await tick();
  ok(frame.innerWidth<baseline.width*.6 && paragraph.offsetHeight>baseline.height,'reading zoom changes actual viewport and line wrapping');
  ok(visualTextSize()>baseline.text*1.9 && Math.abs(iframe.getBoundingClientRect().width-baseline.frameWidth)<2,'reading zoom enlarges text while retaining displayed page width');
  ok(getPanelZoomState(host).zoom===1 && visible(),'Ctrl reading zoom never opens Outline or changes geometric state');
  await checkFramePointerZoom({ owner:host, iframe, wheel, tick, ok });
  executePanelZoom(host,'semantic',{action:'set',zoom:1.5});await tick();
  await checkFramePointerZoom({ owner:host, iframe, wheel, tick, ok });
  executePanelZoom(host,'semantic',{action:'set',zoom:2});await tick();
  const reflow={width:frame.innerWidth,height:paragraph.offsetHeight,text:visualTextSize()};
  wheel(doc.body,{altKey:false,fn:true});await tick();
  ok(frame.innerWidth===reflow.width && paragraph.offsetHeight===reflow.height && visualTextSize()>reflow.text,'Fn magnifies without reflow');
  ok(getPanelZoomState(host,'semantic').zoom===2 && visible(),'geometric zoom preserves reading state and page visibility');
  const geometric=getPanelZoomState(host).zoom;wheel(doc.body,{altKey:true});await tick();
  ok(getPanelZoomState(host).zoom>geometric && frame.innerWidth===reflow.width && paragraph.offsetHeight===reflow.height,'Alt fallback magnifies without reflow');
  const beforeReserved=JSON.stringify([getPanelZoomState(host),getPanelZoomState(host,'semantic')]);wheel(doc.body,{shiftKey:true});
  ok(beforeReserved===JSON.stringify([getPanelZoomState(host),getPanelZoomState(host,'semantic')]),'fisheye cannot change either state');
  const toolbar=document.createElement('div');document.body.append(toolbar);const sync=appendPanelZoomModeControls(toolbar,()=>host);
  setPanelZoomMode(host,'semantic');sync();ok(toolbar.querySelector('[aria-label="Semantic detail"]').hidden,'HTML has no outline/detail list');
  const plus=toolbar.querySelector('[aria-label="Increase panel zoom detail or scale"]');plus.focus();plus.click();
  ok(getPanelZoomState(host,'semantic').zoom>2 && visible() && document.activeElement===plus,'toolbar reading zoom keeps page and focus');
  const reading=getPanelZoomState(host,'semantic').zoom;
  doc.body.dispatchEvent(new frame.KeyboardEvent('keydown',{bubbles:true,cancelable:true,ctrlKey:true,altKey:true,key:'0'}));
  ok(getPanelZoomState(host).zoom===1 && getPanelZoomState(host,'semantic').zoom===reading,'geometric reset leaves reading zoom');
  doc.body.dispatchEvent(new frame.KeyboardEvent('keydown',{bubbles:true,cancelable:true,ctrlKey:true,key:'0'}));await tick();
  ok(getPanelZoomState(host,'semantic').zoom===1 && frame.innerWidth===baseline.width && paragraph.offsetHeight===baseline.height,'reading reset restores original layout');
  ok(!executePanelZoom(host,'semantic',{action:'set',level:'outline'}),'old outline command refused');
  const samples=[],geometry=[];
  for(let i=0;i<100;i++){const start=performance.now();executePanelZoom(host,'semantic',{action:'set',zoom:i%2?1:1.2});samples.push(performance.now()-start);ok(visible(),'all reading transitions retain page');}
  for(let i=0;i<20;i++){const start=performance.now();executePanelZoom(host,'geometric',{action:'set',zoom:i%2?1:1.2});geometry.push(performance.now()-start);}
  await tick();ok(mutations===0 && source===doc.documentElement.outerHTML && loads===0,'both modes produce no authored mutations or reloads');
  ok(JSON.stringify(window.NodevisionState)===state && selection.anchorNode===selected && selection.toString()===selectedText,'canonical state and browser selection preserved');observer.disconnect();
  const stats=values=>{values.sort((a,b)=>a-b);return {medianMs:values[Math.floor(values.length/2)],p95Ms:values[Math.ceil(values.length*.95)-1]};};
  timings.htmlViewerReflow2000Regions=stats(samples);timings.htmlViewerGeometric2000Regions=stats(geometry);
  executePanelZoom(host,'semantic',{action:'set',zoom:1.5});executePanelZoom(host,'geometric',{action:'set',zoom:2});host.style.width='500px';await tick();await tick();
  ok(getPanelZoomState(host,'semantic').zoom===1.5 && getPanelZoomState(host).zoom===2 && frame.innerWidth<baseline.width,'panel resize keeps both scales');
  window.activeCell=other;const inactive=getPanelZoomState(host,'semantic').zoom;wheel(doc.body,{altKey:false});ok(getPanelZoomState(host,'semantic').zoom===inactive,'inactive iframe refused');window.activeCell=host;
  const retainedWidth=iframe.style.width;
  host.hidden=true;ok(!executePanelZoom(host,'semantic',{action:'set',zoom:2}),'hidden owner refuses dispatch');await tick();await tick();
  ok(iframe.style.width===retainedWidth,'inactive tab keeps its layout dimensions');host.hidden=false;await tick();
  await load('<main id="replacement">New document</main>','next.html');
  ok(getPanelZoomState(host).zoom===1 && getPanelZoomState(host,'semantic').zoom===1 && visible(),'replacement resets independent scales with no Outline');
  doc.body.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,altKey:true,deltaY:-100}));ok(getPanelZoomState(host).zoom===1,'old document bridge removed');
  const second=document.createElement('iframe');const loaded=new Promise(resolve=>second.addEventListener('load',()=>{if(second.contentDocument?.querySelector('#second'))resolve();}));
  await renderFile('second.html',other,second,'/Notebook',{liveContent:{content:'<main id="second">Second viewer</main>'}});await loaded;await tick();window.activeCell=other;
  wheel(second.contentDocument.body);wheel(second.contentDocument.body,{altKey:false});
  ok(getPanelZoomState(other).zoom>1 && getPanelZoomState(other,'semantic').zoom>1 && getPanelZoomState(host).zoom===1 && getPanelZoomState(host,'semantic').zoom===1,'viewer scales isolated');
  other._dispose();host._dispose();ok(!getPanelZoomCapabilities(host).geometric && !getPanelZoomCapabilities(host).semantic && iframe.__nvHtmlViewerZoomCleanup===null,'both modes clean up');
  ok(iframe.style.transform==='' && iframe.style.zoom==='','disposal restores frame styles');host.remove();other.remove();toolbar.remove();
}

// Nodevision/ApplicationSystem/tests/lineVertexSnapBrowser.mjs
// These integration checks drive both real Line tools through snapping, closure, transforms, and history. SVG angular fallback is compared with its existing formula, independently of vertex selection.
import { assert, pointer } from './vectorDrawingBrowser.mjs';
const near=(a,b)=>Math.abs(a-b)<.001;
const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const vertices=[[10,10],[60,17],[90,65]];
const key=(host,key,type='keydown',shiftKey=false)=>host.dispatchEvent(new KeyboardEvent(type,{key,shiftKey,bubbles:true,cancelable:true}));
function exercise({svg,host,start,active,count,endpoint,hide,finish,geometry,undo,redo,angular}) {
  const move=(x,y,shiftKey=true)=>pointer(svg,'pointermove',x,y,{shiftKey});
  const down=(x,y,shiftKey=false)=>pointer(svg,'pointerdown',x,y,{shiftKey});
  const eq=(a,b)=>near(a.x,b[0])&&near(a.y,b[1]);
  start();down(...vertices[0]);down(...vertices[1]);down(...vertices[2]);
  move(61,18);assert(eq(endpoint(),vertices[1]),'intermediate exact preview');
  down(61,18,true);assert(active()&&count()===4,'intermediate reconnection stays active');
  down(...vertices[1],true);assert(count()===4,'current endpoint creates no zero segment');
  move(11,11);assert(eq(endpoint(),vertices[0])&&active(),'start previews but does not close');
  key(host,'Shift','keyup');assert(eq(endpoint(),[11,11]),'Shift release restores raw endpoint without moving');
  key(host,'Shift','keydown',true);assert(eq(endpoint(),vertices[0]),'Shift press restores vertex preview');
  move(30,65);if(angular) angular(endpoint(),vertices[1],[30,65]);else assert(eq(endpoint(),[30,65]),'raster fallback unchanged');
  move(11,11);assert(eq(endpoint(),vertices[0]),'returning inside tolerance snaps again');
  down(11,11,true);assert(!active(),'starting vertex closes and finishes');
  const closed=geometry();assert(closed.closed&&closed.points.length===4,'native closed geometry has no duplicate start');
  assert(eq(closed.points[3],vertices[1]),'committed intermediate equals exact earlier coordinate');
  undo();redo();assert(JSON.stringify(geometry())===JSON.stringify(closed),'closed geometry survives undo/redo');
  start();down(10,10);down(60,17);down(11,11,true);assert(active(),'two vertices cannot close');key(host,'Escape');
  start();vertices.forEach(p=>down(...p));hide(true);move(11,11);assert(!eq(endpoint(),vertices[0]),'hidden candidate excluded');hide(false);key(host,'Escape');
  // A completed object's vertex at 10,10 is never part of this new path's candidates.
  start();down(45,40);down(95,25);move(11,11);assert(!eq(endpoint(),vertices[0]),'completed path cannot capture endpoint');key(host,'Escape');
  // Explicit finish continues to produce an open path.
  start();down(30,30);down(60,35);finish();assert(!geometry().closed,'Enter leaves open paths open');undo();
}
export async function run() {
  const passed=[];
  try {
    const {renderEditor}=await import('/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs');
    const host=document.createElement('div');host.style.cssText='width:900px;height:650px';document.body.append(host);
    const cleanup=await renderEditor('vector-test.svg',host);const ctx=window.SVGEditorContext,svg=ctx.svgRoot,wrapper=host.querySelector('[tabindex]');
    const path=()=>[...new DOMParser().parseFromString(ctx.getEditorHTML(),'image/svg+xml').querySelectorAll('path')].at(-1);
    const geometry=()=>{const d=path().getAttribute('d'), values=d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);return {closed:d.endsWith('Z'),points:values.reduce((a,v,i)=>{if(!(i%2))a.push({x:v,y:values[i+1]});return a;},[])};};
    const preview=()=>host.querySelector('[data-nv-editor-ui="line-tool-preview-line"]');
    for(const zoom of [.75,1,3]) {
      svg.style.transform=`translate(37px, 21px) rotate(17deg) scale(${zoom})`;await frame();
      exercise({svg,host:wrapper,start:()=>ctx.setMode('line'),active:()=>ctx.debugLineToolState().active,count:()=>ctx.debugLineToolState().pointCount,
        endpoint:()=>({x:+preview().getAttribute('x2'),y:+preview().getAttribute('y2')}),
        hide:value=>host.querySelector('[data-nv-editor-ui="line-tool-vertex-marker"]').style.setProperty('display',value?'none':'inline','important'),
        finish:()=>key(wrapper,'Enter'),geometry,undo:()=>ctx.undo(),redo:()=>ctx.redo(),
        angular(actual,anchor,raw){const dx=raw[0]-anchor[0],dy=raw[1]-anchor[1],r=Math.hypot(dx,dy),a=Math.round(Math.atan2(dy,dx)/(Math.PI/12))*Math.PI/12;assert(near(actual.x,anchor[0]+r*Math.cos(a))&&near(actual.y,anchor[1]+r*Math.sin(a)),'existing SVG angular calculation unchanged');}});
    }
    // Local-layer conversion must retain the exact committed coordinate on reconnection.
    const layer=ctx.createLayer('Snap transform');layer.setAttribute('transform','translate(3 5) rotate(13) scale(1.7 0.8)');ctx.setActiveLayer(layer.id);ctx.setMode('line');
    vertices.forEach(([x,y])=>pointer(ctx.svgRoot,'pointerdown',x,y));pointer(ctx.svgRoot,'pointerdown',61,18,{shiftKey:true});pointer(ctx.svgRoot,'pointerdown',11,11,{shiftKey:true});
    const coords=layer.querySelector('path').getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
    assert(coords[2]===coords[6]&&coords[3]===coords[7],'transformed layer reconnection preserves exact coordinates');
    const saved=ctx.getEditorHTML();ctx.setEditorHTML(saved);assert(geometry().closed,'SVG save/reload keeps Z');
    cleanup();host.remove();passed.push('SVG: snapping priority, hidden/external/current exclusions, Shift release, angular fallback, zoom/pan/rotation, layer transforms, Z/history/reload');
    const global=document.createElement('div');global.id='global-toolbar';const sub=document.createElement('div');sub.id='sub-toolbar';document.body.append(global,sub);
    await (await import('/panels/createToolbar.mjs')).createToolbar();
    const {mountImageViewport}=await import('/PanelInstances/ViewPanels/FileViewers/ImageViewport.mjs');
    const {installPngAnalysisTools}=await import('/RasterAnalysis/PngAnalysisTools.mjs');
    const {getActiveAnalysisTools}=await import('/RasterAnalysis/AnalysisToolsContext.mjs');
    const raster=document.createElement('div');raster.className='panel';raster.style.cssText='width:700px;height:480px';document.body.append(raster);window.activeCell=raster;window.__nvActivePanelElement=raster;
    const img=new Image();img.src='/Notebook/test.PNG';await img.decode();const viewport=mountImageViewport(raster,img);
    const dispose=installPngAnalysisTools(raster,viewport,'vertex-snap.PNG',async()=>({panel:document.createElement('div')}));
    const context=getActiveAnalysisTools(),analysis=context.analysis,controls=document.createElement('div');document.body.append(controls);const unmount=context.mount(controls);
    const click=name=>[...controls.querySelectorAll('button')].find(b=>b.textContent===name).click();const overlay=raster.querySelector('[data-png-analysis-overlay]');
    for(const zoom of [.75,1,3]) {
      viewport.command({action:'set',zoom});viewport.command({action:'pan',dx:15,dy:20});viewport.state.angle=17;viewport.render();await frame();
      exercise({svg:overlay,host:raster,start:()=>click('Line'),active:()=>Boolean(overlay.lastChild.children.length),
        count:()=>{const d=overlay.lastChild.querySelector('path')?.getAttribute('d')||'';return (d.match(/[ML]/g)||[]).length;},
        endpoint:()=>{const nums=overlay.lastChild.querySelector('path').getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);return{x:nums.at(-2),y:nums.at(-1)};},
        hide:value=>{overlay.lastChild.style.visibility=value?'hidden':'';},finish:()=>key(raster,'Enter'),geometry:()=>analysis.annotations.at(-1),undo:()=>click('Undo annotation'),redo:()=>click('Redo annotation')});
    }
    click('Analyze annotation');assert(analysis.regions[0]?.geometry?.closed,'closed Line feeds region analysis');
    unmount();dispose();raster._dispose();raster.remove();controls.remove();passed.push('Image Analysis: shared eligibility, preview/commit, closure/history, transformed masks and region handoff');
    return{ok:true,passed};
  } catch(error) {return{ok:false,passed,error:error.stack};}
}

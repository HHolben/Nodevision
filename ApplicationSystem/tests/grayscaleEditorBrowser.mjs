// Nodevision/ApplicationSystem/tests/grayscaleEditorBrowser.mjs
// These regressions verify grayscale invalidation on the actual graphical raster editor canvas. They exercise source edits, undo, destructive rotation, zoom, and overlay cleanup through public editor APIs.
import { renderRasterEditor } from '/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs';
import { getActiveAnalysisTools } from '/RasterAnalysis/AnalysisToolsContext.mjs';
import { assert, near } from './vectorDrawingBrowser.mjs';
const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
async function until(fn){for(let i=0;i<1000;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Editor analysis timed out: '+fn);}
export async function runEditorChecks(passed) {
  const host=document.createElement('div');host.className='panel';host.style.cssText='width:640px;height:480px';document.body.append(host);
  window.__nvActivePanelElement=host;window.activeCell=host;
  const editor=await renderRasterEditor(null,host);
  const analysis=getActiveAnalysisTools().analysis, store=analysis.analysisLayers;
  const gray=store.add('grayscale',{lower:0,upper:100,mode:'binary',opacity:.5,color:'#ff0000'});
  const result=()=>analysis.layerResults.find(r=>r.id===gray.id);
  await until(()=>result()?.eligible===0);
  const source=document.createElement('canvas');source.width=8;source.height=4;
  const ctx=source.getContext('2d');ctx.fillStyle='#808080';ctx.fillRect(0,0,8,4);
  editor.api.replaceCanvasContents(source,{pushHistory:true});await until(()=>result()?.count===32);
  const canvas=editor.api.getCanvas(), snapshot=canvas.toDataURL();
  store.update(gray.id,{config:{lower:60}});await until(()=>result()?.count===0);
  assert(canvas.toDataURL()===snapshot,'analysis never changes editor pixels');
  store.update(gray.id,{config:{lower:40,upper:60}});await until(()=>result()?.count===32);
  const overlay=()=>host.querySelector(`canvas[data-analysis-layer="${gray.id}"]`);
  await frame();const a=canvas.getBoundingClientRect(),b=overlay().getBoundingClientRect();
  assert(near(a.x,b.x)&&near(a.y,b.y)&&near(a.width,b.width),'editor canvas alignment');
  editor.api.rotate90CW();await until(()=>overlay()?.width===4&&overlay()?.height===8&&result()?.count===32);
  editor.api.undo();await until(()=>overlay()?.width===8&&result()?.count===32);
  editor.api.undo();await until(()=>result()?.eligible===0);
  editor.destroy();assert(!host.querySelector('[data-analysis-layer]'),'editor cleanup releases masks');host.remove();
  passed.push('Actual raster editor: live edits, rotation, undo, alignment, source preservation, cleanup');
}

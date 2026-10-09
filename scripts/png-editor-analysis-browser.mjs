// Nodevision/scripts/png-editor-analysis-browser.mjs
// This fixture verifies shared polygon analysis against the PNG editor's live pixels, native zoom and scrolling, raster undo, export safety, dimension changes, and destruction.
import toggleAnalysisTools from '/ToolbarCallbacks/view/AnalysisTools.mjs';
import { renderEditor } from '/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs';
import { executePanelZoom } from '/panels/panelZoomCapabilities.mjs';
export async function checkPngEditorAnalysis() {
  const ok = (value, message) => { if (!value) throw Error(message); };
  const tick = () => new Promise(resolve => requestAnimationFrame(resolve));
  async function wait(check) { for(let i=0;i<300;i++) { if(check()) return; await new Promise(r=>setTimeout(r,20)); } throw Error('Editor analysis timeout: '+check); }
  const host = document.createElement('div'); host.style.cssText='width:650px;height:450px';document.body.append(host);
  const editor = await renderEditor('',host), canvas=editor.api.getCanvas();
  const source=document.createElement('canvas');source.width=source.height=100;
  const ctx=source.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,50,100);ctx.fillStyle='blue';ctx.fillRect(50,0,50,100);
  editor.api.replaceCanvasContents(source);await tick();await tick();
  const baseline=canvas.toDataURL(), menu=host.querySelector('[data-png-analysis]'), svg=host.querySelector('[data-png-analysis-overlay]');
  ok(menu.hidden&&menu.getClientRects().length===0,'editor toolbar hidden initially');
  host.classList.add('panel');window.activeCell=host;
  const viewMenu=document.createElement('div');document.body.append(viewMenu);const toggle=document.createElement('button');toggle.onclick=toggleAnalysisTools;viewMenu.append(toggle);
  viewMenu.querySelector('button').click();ok(!menu.hidden,'View button opens editor analysis');await tick();
  const click=label=>[...menu.querySelectorAll('button')].find(b=>b.textContent===label).click();
  function region(label,points) {
    click(label);
    points.forEach(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());svg.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y,button:0}));});
    svg.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  }
  const result=()=>document.querySelector('[data-instance-name="PngAnalysis"]');
  region('Region',[[0,0],[100,0],[100,100],[0,100]]);
  await wait(()=>result()?.textContent.includes('Current selection: 10000 pixels'));
  ok(result().textContent.includes('RGB(128, 0, 128)'),'editor average');
  ok(!editor.api.canUndo()&&canvas.toDataURL()===baseline,'analysis leaves pixels and raster history untouched');
  executePanelZoom(host,'geometric',{action:'set',zoom:8});await tick();await tick();
  canvas.parentElement.scrollLeft=35;canvas.parentElement.scrollTop=29;await tick();
  const a=svg.getBoundingClientRect(),b=canvas.getBoundingClientRect();
  ok(Math.abs(a.left-b.left)<1&&Math.abs(a.top-b.top)<1&&Math.abs(a.width-b.width)<1,'editor overlay aligns under zoom and scroll');
  region('Subtract polygon',[[0,0],[50,0],[50,100],[0,100]]);
  await wait(()=>result()?.textContent.includes('RGB(0, 0, 255)'));
  ok(result().textContent.includes('50.00%'),'editor secondary percentage');
  ctx.fillStyle='lime';ctx.fillRect(0,0,100,100);editor.api.replaceCanvasContents(source,{pushHistory:true});
  await wait(()=>result()?.textContent.includes('RGB(0, 255, 0)'));
  editor.api.undo();await wait(()=>result()?.textContent.includes('RGB(0, 0, 255)'));
  editor.api.redo();await wait(()=>result()?.textContent.includes('RGB(0, 255, 0)'));
  // Exercise the brush completion path, independently from the replace-content API.
  window.NodevisionState.drawTool='brush';window.NodevisionState.drawColor='#ff0000';window.NodevisionState.drawBrushSize=200;
  const p=canvas.getBoundingClientRect();canvas.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:p.left+p.width*.75,clientY:p.top+p.height*.5,button:0}));
  window.dispatchEvent(new MouseEvent('mouseup',{clientX:p.left+p.width*.75,clientY:p.top+p.height*.5,button:0}));
  await wait(()=>result()?.textContent.includes('RGB(255, 0, 0)'));
  source.width=source.height=40;editor.api.replaceCanvasContents(source);
  await wait(()=>result()?.textContent.includes('Draw a region'));
  ok(!svg.querySelector('mask'),'dimension changes clear stale regions');
  region('Region',[[0,0],[40,0],[40,40],[0,40]]);editor.destroy();await tick();
  ok(!result()&&!host.querySelector('[data-png-analysis]'),'editor destruction removes analysis and result panel');
  host.remove();viewMenu.remove();window.activeCell=null;
}

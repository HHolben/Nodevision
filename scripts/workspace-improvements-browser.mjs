// Nodevision/scripts/workspace-improvements-browser.mjs
// These browser regressions exercise raster pixel sizing, screen-space keyboard controls, zoom input ownership, File Manager layout and selection, and neutral saved workspace restoration.
import { renderRasterEditor } from '/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs';
import { executePanelZoom } from '/panels/panelZoomCapabilities.mjs';
import { mountImageViewport } from '/PanelInstances/ViewPanels/FileViewers/ImageViewport.mjs';
import { installPanelZoomShortcuts } from '/panels/panelZoomPan.mjs';
import { registerPanelZoomCapabilities } from '/panels/panelZoomCapabilities.mjs';
import { bindFileManagerFollowSelection } from '/PanelInstances/InfoPanels/FileManagerFollowSelection.mjs';
import { installActivePanelFileSelection } from '/panels/activePanelFileSelection.mjs';
import { getNodevisionSelectedPath, setNodevisionSelectedPath } from '/NodevisionSelection.mjs';
import { mountNeutralLayoutPanel } from '/panels/neutralLayoutPanel.mjs';
import { renderLayout } from '/panels/workspaceParts/workspaceLayoutRender.mjs';
import { sanitizeWorkspaceLayout, saveNamedLayout } from '/panels/savedLayoutModel.mjs';
import { showSavedLayouts } from '/panels/savedLayouts.mjs';
const ok = (v,m) => { if (!v) throw Error(m); };
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
function panel() {
  const cell = document.createElement('div'); cell.className = 'panel-cell'; cell.dataset.id = 'FileView';
  const host = document.createElement('div'); host.className = 'panel'; host.style.cssText = 'width:400px;height:300px';
  cell.append(host); document.body.append(cell); return { cell, host };
}
try {
  window.NodevisionState = {};
  const a = panel(), b = panel(); window.activeCell = a.cell;
  const source = document.createElement('canvas'); source.width = 640; source.height = 480;
  const context = source.getContext('2d'); context.fillStyle = 'red'; context.fillRect(0,0,320,480); context.fillStyle = 'blue'; context.fillRect(320,0,320,480);
  const image = new Image(); image.src = source.toDataURL('image/jpeg'); await image.decode();
  const original = image.src, api = mountImageViewport(a.host, image);
  const shortcuts = installPanelZoomShortcuts();
  api.command({ action: 'reset' });
  ok(image.getBoundingClientRect().width === 640, '100% is native CSS pixel width');
  for (const angle of [0,90,180,270,37]) for (const [key,dx,dy] of [['ArrowLeft',-20,0],['ArrowRight',20,0],['ArrowUp',0,-20],['ArrowDown',0,20]]) {
    api.state.angle = angle; api.render(); const before = image.getBoundingClientRect();
    a.host.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const after = image.getBoundingClientRect();
    ok(Math.abs(after.x-before.x-dx)<.01 && Math.abs(after.y-before.y-dy)<.01, `screen pan ${angle} ${key}`);
  }
  for (let i=0;i<30;i++) { api.state.angle += 90; api.command({ factor: 1.1 }); api.command({ factor: 1/1.1 }); }
  ok(image.src === original && image.naturalWidth === 640 && image.naturalHeight === 480, 'cycles retain original decoded source');
  api.state.angle = 90; api.command({ action: 'reset' });
  ok(Math.abs(image.getBoundingClientRect().width-480)<.01, 'rotation swaps visual extents only');
  const wheel = (host, extras = {}) => { const e = new WheelEvent('wheel', { ctrlKey: true, altKey: true, deltaY: -100, bubbles: true, cancelable: true, ...extras }); if (extras.fn) Object.defineProperty(e, 'getModifierState', {value:key=>key==='Fn'}); host.dispatchEvent(e); return e; };
  const before = api.state.zoom; ok(wheel(a.host).defaultPrevented && api.state.zoom > before, 'active geometric input claimed');
  ok(!wheel(b.host).defaultPrevented, 'inactive panel gesture unclaimed');
  ok(wheel(a.host, { shiftKey: true }).defaultPrevented, 'unsupported fisheye reserved without geometric fallback');
  ok(wheel(a.host, { altKey: false }).defaultPrevented, 'unsupported semantic reserved without geometric fallback');
  ok(!wheel(document.body).defaultPrevented, 'outside workspace unclaimed');
  const rasterHost=document.createElement('div'); rasterHost.className='panel'; rasterHost.style.cssText='width:400px;height:300px'; document.body.append(rasterHost);
  const raster=await renderRasterEditor('',rasterHost);
  const displayedImage=new Image(); displayedImage.src=original; await displayedImage.decode(); displayedImage.width=160; displayedImage.height=120;
  raster.api.replaceCanvasContents(displayedImage);
  ok(raster.api.getCanvas().width===640 && raster.api.getCanvas().height===480,'import uses native image dimensions instead of fitted preview');
  raster.api.replaceCanvasContents(source);
  const pixels=raster.api.getCanvas().toDataURL();
  window.activeCell=rasterHost;const widthBefore=raster.api.getCanvas().style.width;
  wheel(rasterHost,{altKey:false});ok(raster.api.getCanvas().style.width===widthBefore,'PNG editor Ctrl semantic cannot resize canvas');
  wheel(rasterHost,{altKey:false,fn:true});ok(parseFloat(raster.api.getCanvas().style.width)>parseFloat(widthBefore),'PNG editor exposed Fn changes geometric display scale');
  executePanelZoom(rasterHost,'geometric',{action:'reset'});
  for(let i=0;i<8;i++) { raster.api.rotate90CW(); executePanelZoom(rasterHost,'geometric',{factor:1.2}); executePanelZoom(rasterHost,'geometric',{action:'reset'}); }
  ok(raster.api.getCanvas().toDataURL()===pixels,'quarter rotations and zoom retain exact canvas pixels');
  ok(raster.api.getCanvas().width===640 && raster.api.getCanvas().style.width==='640px','raster native backing and 100% CSS sizing survive HiDPI');
  raster.destroy(); rasterHost.remove(); window.activeCell=a.cell;
  let detail = 0; const release = registerPanelZoomCapabilities(b.host, { semantic(command) { detail += command.factor; } });
  window.activeCell = b.cell; const imageZoom = api.state.zoom;
  ok(wheel(b.host, { altKey: false }).defaultPrevented && detail > 0, 'semantic routed independently');
  ok(api.state.zoom === imageZoom, 'other panel state unchanged');
  release(); shortcuts.dispose(); a.host._dispose();
  ok(!a.host.hasAttribute('data-nv-panel-zoom-scope'),'image disposal restores generic zoom scope');

  const manager = document.createElement('div'); manager.style.cssText = 'height:240px;width:280px';
  manager.innerHTML = '<div class="file-manager"><h3>Files</h3><div id="loading" style="display:none"></div><div id="error"></div><ul id="file-list" class="file-list"></ul><div id="fm-path">Notebook / deeply / nested / path</div></div>';
  document.body.append(manager); const list = manager.querySelector('ul');
  function populate(count, prefix='deep/nested') {
    list.replaceChildren();
    for (let i=0;i<count;i++) { const li=document.createElement('li'), link=document.createElement('a'); link.className='file'; link.dataset.fullPath=`${prefix}/${i}.txt`; link.textContent=`File ${i}`; li.style.cssText='flex:0 0 auto;height:28px'; li.append(link); list.append(li); }
  }
  for (const count of [3,200]) for (const zoom of [1,1.5]) for (const height of [240,400]) {
    manager.style.height = height+'px'; manager.style.zoom = zoom; populate(count); list.scrollTop = list.scrollHeight; await tick();
    const last = list.lastElementChild.getBoundingClientRect(), footer = manager.querySelector('#fm-path').getBoundingClientRect();
    ok(last.bottom <= footer.top + 1, 'last file fully above footer at every size/zoom');
  }
  manager.style.zoom=1; populate(200);
  let opens = 0;
  const cleanup = bindFileManagerFollowSelection(manager, { highlight(link) { manager.querySelector('.selected')?.classList.remove('selected'); link.classList.add('selected'); },
    async fetchDirectoryContents(path, callback, error, loading, options) { opens++; await tick(); if(options.isCurrent()) populate(200,path); }, displayFiles() {} });
  setNodevisionSelectedPath('deep/nested/199.txt'); await tick();
  ok(manager.querySelector('.selected')?.dataset.fullPath === 'deep/nested/199.txt', 'canonical selection highlighted');
  const scroll = list.scrollTop; setNodevisionSelectedPath('deep/nested/199.txt'); await tick(); ok(list.scrollTop===scroll,'visible file does not jump');
  setNodevisionSelectedPath('other/deep/150.txt'); await tick(); await tick(); ok(opens===1 && manager.querySelector('.selected')?.dataset.fullPath==='other/deep/150.txt','deep directory revealed');
  const follow = installActivePanelFileSelection(); b.cell.dataset.currentFilePath = 'other/deep/160.txt';
  window.dispatchEvent(new CustomEvent('activePanelChanged',{detail:{cell:b.cell}})); await tick();
  ok(getNodevisionSelectedPath()==='other/deep/160.txt','active file routes through canonical selection');
  b.cell.dataset.id='FileManager'; b.cell.dataset.currentFilePath='invented.txt'; window.dispatchEvent(new CustomEvent('activePanelChanged',{detail:{cell:b.cell}})); await tick();
  ok(getNodevisionSelectedPath()==='other/deep/160.txt','utility panel cannot invent selection'); cleanup(); follow();

  let opened=0; const neutral=document.createElement('div'); const lifecycle=mountNeutralLayoutPanel(neutral,'GraphicalEditor',async()=>{opened++;});
  ok(opened===0 && neutral.textContent.includes('no document'),'neutral editor does not open selected file'); neutral.querySelector('button').click(); await tick(); ok(opened===1,'explicit open works'); lifecycle.destroy();
  const workspace=document.getElementById('workspace');
  const layout=sanitizeWorkspaceLayout({type:'row',direction:'column',flex:'2 1 0',children:[{type:'cell',panelType:'FileView',panelClass:'ViewPanel',flex:'3 1 0',tabs:[{tabId:'x',panelType:'FileView',panelVars:{filePath:'private.svg'}},{tabId:'y',panelType:'GraphicalEditor',panelVars:{content:'secret'}}],activeTabId:'y'}, {type:'cell',panelType:'GraphManager',panelClass:'InfoPanel',flex:'1 1 0'}]});
  await renderLayout(layout,workspace);
  ok(workspace.firstElementChild.style.flex==='2 1 0px','split proportions preserved');
  ok(workspace.querySelectorAll('.panel-cell').length===2,'two cells restored');
  ok(window.layoutMounts.length===3 && window.layoutMounts.every(item=>!item.vars.filePath && item.vars.layoutEmpty),'tabs restored without files');
  localStorage.clear(); saveNamedLayout(localStorage,'Writing',layout); saveNamedLayout(localStorage,'Drawing',layout); showSavedLayouts();
  const dialog=document.querySelector('dialog'); const search=dialog.querySelector('input'); search.value='writ'; search.dispatchEvent(new Event('input'));
  ok(dialog.querySelector('select').options.length===1,'saved layout search'); dialog.querySelector('select').selectedIndex=0; dialog.querySelector('button').click(); await tick();
  ok(workspace.querySelectorAll('.panel-cell').length===2,'selected saved layout loads');
  document.getElementById('result').textContent='PASS: image native pixels, arbitrary-angle screen panning, no resampling, zoom ownership/capabilities, File Manager reveal/layout at sizes and zooms, neutral panels, saved layout search and structural restore.';
} catch(error) { document.getElementById('result').textContent='FAIL: '+error.stack; }

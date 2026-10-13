// Nodevision/scripts/active-tool-browser.mjs
// This regression verifies the real Cursor widget follows semantic tools and panel ownership while incidental pointer presentation leaves its icon and DOM unchanged.
import { initToolbarWidget } from '/ToolbarJSONfiles/contextualCursorFamilyWidget.mjs';
import { registerPanelActiveTool, notifyActiveToolChanged } from '/CursorFamilies/PanelActiveTool.mjs';
import { setEditorContext } from '/EditorAttentionState.mjs';
const ok=(v,m)=>{if(!v)throw Error(m);},tick=()=>new Promise(r=>setTimeout(r,50));
try {
  window.NodevisionState={currentMode:'SVG Editing',selectedFile:'same.svg'};
  const host=document.createElement('div');document.body.prepend(host);
  const panels=Array.from({length:4},()=>{const p=document.createElement('div');p.className='panel';document.body.append(p);return p;});
  const modes=['select','line'],releases=[];
  for(let i=0;i<2;i++)releases.push(registerPanelActiveTool(panels[i],{currentMode:'SVG Editing',filePath:'same.svg',editorContext:{getMode:()=>modes[i],setMode:m=>{modes[i]=m;notifyActiveToolChanged(panels[i]);}}}));
  let interaction='text-edit';
  releases.push(registerPanelActiveTool(panels[2],{currentMode:'HTMLediting',filePath:'index.html',getInteractionTool:()=>interaction}));
  releases.push(registerPanelActiveTool(panels[3],{currentMode:'3D World Viewing',filePath:'index.html'}));
  async function focus(i){window.activeCell=panels[i];window.dispatchEvent(new CustomEvent('activePanelChanged',{detail:{panel:panels[i]}}));await tick();}
  await focus(0);initToolbarWidget(host);await tick();
  const active=()=>host.querySelector('.nv-cursor-family-widget')?.dataset.activeTool;
  const glyph=()=>host.querySelector('.nv-cursor-family-main .nv-cursor-family-glyph')?.textContent;
  ok(active()==='object-select'&&glyph()==='↖','Selection arrow');
  let button=host.querySelector('.nv-cursor-family-main');
  for(const cursor of ['text','nwse-resize','grabbing','crosshair','wait']){
    panels[0].style.cursor=cursor;document.body.style.cursor=cursor;
    panels[0].dispatchEvent(new PointerEvent('pointermove',{bubbles:true}));
    panels[0].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await tick();
    ok(host.querySelector('.nv-cursor-family-main')===button&&glyph()==='↖','incidental '+cursor+' leaves icon unchanged');
  }
  await focus(1);ok(active()==='line-draw','panel-owned Line');button=host.querySelector('.nv-cursor-family-main');
  for(let i=0;i<5;i++){panels[1].dispatchEvent(new PointerEvent('pointerdown'));panels[1].dispatchEvent(new PointerEvent('pointerup'));}
  notifyActiveToolChanged(panels[1]);await tick();ok(host.querySelector('.nv-cursor-family-main')===button,'unchanged Line avoids rebuild');
  modes[1]='select';notifyActiveToolChanged(panels[1]);await tick();ok(active()==='object-select','lifecycle updates icon');
  modes[1]='line';await focus(0);ok(active()==='object-select','first panel retains Selection');await focus(1);ok(active()==='line-draw','second panel retains Line');
  await focus(2);ok(active()==='text-edit'&&glyph()==='Ⅰ','Text mode');
  interaction='pan';notifyActiveToolChanged(panels[2]);await tick();ok(active()==='hand-pan'&&glyph()==='✋','Pan hand');
  button=host.querySelector('.nv-cursor-family-main');panels[2].style.cursor='grabbing';window.dispatchEvent(new Event('pointerlockchange'));await tick();ok(button===host.querySelector('.nv-cursor-family-main'),'drag leaves Pan unchanged');
  await focus(3);ok(active()==='gameplay'&&glyph()==='⊕','World interaction overrides HTML extension');
  setEditorContext({filePath:'other.html',editorMode:'HTMLediting',activeTool:'pan'});await tick();ok(active()==='gameplay','inactive editor cannot override gameplay');
  setEditorContext({filePath:'index.html',editorMode:'HTMLediting',activeTool:'pan'});await tick();ok(active()==='gameplay','same-file editor cannot override gameplay');
  await focus(0);setEditorContext({filePath:'same.svg',editorMode:'SVG Editing',activeTool:'text-edit'});await tick();ok(active()==='object-select','same-file attention cannot override panel-owned selection');
  const csvPanel=document.createElement('div');csvPanel.className='panel';document.body.append(csvPanel);
  const originalFetch=window.fetch;window.fetch=(url,...args)=>String(url).includes('/Notebook/cursor.csv')?Promise.resolve(new Response('A,B\nC,D')):originalFetch(url,...args);
  const {renderEditor}=await import('/PanelInstances/EditorPanels/GraphicalEditors/CSVeditor.mjs');
  window.activeCell=csvPanel;const cleanupCsv=await renderEditor('cursor.csv',csvPanel);
  window.dispatchEvent(new CustomEvent('activePanelChanged',{detail:{panel:csvPanel}}));await tick();
  const cell=csvPanel.querySelector('td');cell.focus();
  cell.dispatchEvent(new KeyboardEvent('keydown',{key:'F2',bubbles:true,cancelable:true}));await tick();
  ok(active()==='text-edit','real CSV F2 changes semantic mode');
  cell.style.cursor='nwse-resize';cell.dispatchEvent(new PointerEvent('pointermove',{bubbles:true}));await tick();
  ok(active()==='text-edit','CSV hover cannot override editing mode');
  cell.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await tick();
  ok(active()==='cell-select','real CSV Escape restores selection tool');cleanupCsv();window.fetch=originalFetch;
  host.__nvCleanupCursorFamilyWidget();releases.forEach(release=>release());
  document.getElementById('result').textContent='PASS: tool icons, pointer isolation, panel ownership, lifecycle updates, text/Pan/gameplay, mode precedence, and render deduplication';
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}

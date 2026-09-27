// Nodevision/scripts/csv-range-browser.mjs
// This browser regression suite exercises the real CSV editor and table command adapter, including a structural pointer-work benchmark on a large rendered grid.
import { renderEditor } from '/PanelInstances/EditorPanels/GraphicalEditors/CSVeditor.mjs';
import { subscribe, getSnapshot } from '/EditorAttentionState.mjs';
import * as tableTools from '/ToolbarCallbacks/insert/tableTools.mjs';
const equal = (actual, expected, message) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
};
const ok = (value, message) => { if (!value) throw new Error(message); };
const container = document.getElementById('test-editor');
const cell = (r,c) => window.__nvCsvEditor.table.rows[r].cells[c];
const rows = () => window.__nvCsvEditor.getRows();
const selection = () => window.__nvCsvEditor.getSelection();
const reset = data => { window.__nvCsvEditor.setRows(data,{markDirty:false}); window.NodevisionState.fileIsDirty=false; };
let hitCell;
const realHitTest = document.elementFromPoint.bind(document);
// Deterministic hit testing lets the large-grid benchmark include offscreen cells.
document.elementFromPoint = (x,y) => hitCell || realHitTest(x,y);
function pointer(type,r,c,options={}) {
  const target = cell(r,c); hitCell=target;
  const rect=target.getBoundingClientRect();
  target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,button:0,isPrimary:true,
    clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,...options}));
}
function click(r,c,options={}) { pointer('pointerdown',r,c,options); pointer('pointerup',r,c,options); }
function key(name,options={}) { document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true,...options})); }
function clipboard(type,text='') {
  const data = new DataTransfer(); if(type==='paste') data.setData('text/plain',text);
  document.activeElement.dispatchEvent(new ClipboardEvent(type,{bubbles:true,cancelable:true,clipboardData:data}));
  return data.getData('text/plain');
}
try {
  window.NodevisionState={};
  let attentionUpdates=0; const unsubscribe=subscribe(()=>{attentionUpdates++;});
  await renderEditor('fixture.csv',container);
  const editor=window.__nvCsvEditor;
  ok(editor,'editor loads');
  reset([['A','B','C'],['D','E','F'],['G','H','I']]);
  click(1,1); equal(selection().anchor,{row:1,col:1},'single cell anchor');
  equal(selection().active,{row:1,col:1},'single cell active'); equal(clipboard('copy'),'E','single cell copy');
  equal(getSnapshot().selectedObjectType,'csv-range','canonical attention selection');
  for (const [a,b] of [[[0,0],[1,1]],[[1,1],[0,0]],[[0,1],[1,0]],[[1,0],[0,1]]]) {
    click(2,2); pointer('pointerdown',...a); pointer('pointermove',...b); pointer('pointerup',...b);
    equal(selection().range,{top:0,left:0,bottom:1,right:1},'all drag directions');
    equal(selection().anchor,{row:a[0],col:a[1]},'anchor remains fixed');
    equal(selection().active,{row:b[0],col:b[1]},'active follows pointer');
  }
  click(0,0); click(1,1,{shiftKey:true}); equal(clipboard('copy'),'A\tB\nD\tE','rectangle copy');
  key('ArrowRight',{shiftKey:true}); equal(selection().range,{top:0,left:0,bottom:1,right:2},'shift arrow');
  key('ArrowDown'); equal(selection().range,{top:2,left:2,bottom:2,right:2},'normal arrow collapses');
  click(0,0); click(1,1,{shiftKey:true}); equal(clipboard('cut'),'A\tB\nD\tE','cut data');
  equal(rows(),[['','','C'],['','','F'],['G','H','I']],'cut clears once');
  key('z',{ctrlKey:true}); equal(rows()[0],['A','B','C'],'undo cut');
  key('z',{metaKey:true,shiftKey:true}); equal(rows()[0],['','','C'],'Cmd shift redo');
  reset([['A']]); click(1,1); click(2,2,{shiftKey:true});
  equal(rows(),[['A']],'select virtual cells does not declare'); ok(!window.NodevisionState.fileIsDirty,'selection stays clean');
  click(1,1); clipboard('paste','B\t\nC\tD');
  equal(rows(),[['A'],['','B',''],['','C','D']],'paste beyond dimensions retains trailing empty field');
  key('z',{ctrlKey:true}); equal(rows(),[['A']],'paste is one undo');
  clipboard('paste','X'); equal(rows(),[['A'],['','X']],'single paste');
  reset([['A','B','C'],['D','E','F']]); click(0,0); click(1,1,{shiftKey:true});
  let records=0; const record=editor.history.record.bind(editor.history);
  editor.history.record=before=>{records++;return record(before);};
  pointer('pointerdown',0,0); pointer('pointermove',0,1);
  equal(records,0,'no history during move'); equal(rows(),[['A','B','C'],['D','E','F']],'move preview does not mutate');
  ok(!container.querySelector('.nv-csv-destination').hidden,'destination preview visible');
  pointer('pointerup',0,1); equal(records,1,'one move commit');
  equal(rows(),[['','A','B'],['','D','E']],'overlap move');
  key('z',{ctrlKey:true}); equal(rows(),[['A','B','C'],['D','E','F']],'undo restores source and destination');
  pointer('pointerdown',0,0); pointer('pointermove',1,1); pointer('pointercancel',1,1);
  equal(rows(),[['A','B','C'],['D','E','F']],'cancel move');
  reset([['A',''],['B']]); click(0,0); click(1,1,{shiftKey:true});
  pointer('pointerdown',0,0); pointer('pointermove',2,2);
  ok(!container.querySelector('.nv-csv-destination').hidden,'preview extends beyond rendered grid');
  pointer('pointerup',2,2); equal(rows(),[['',''],[''],['','','A',''],['','','B']],'move declared empty and virtual cells');
  reset([['A']]); click(0,0);
  const edge=cell(0,0).getBoundingClientRect();
  pointer('pointerdown',0,0,{clientX:edge.left+1}); pointer('pointermove',1,1); pointer('pointerup',1,1);
  equal(rows(),[[''],['','A']],'single-cell edge move');
  reset([['A']]); click(1,1); clipboard('cut'); equal(rows(),[['A']],'virtual cut does not materialize');
  reset([['A','B'],['C','D']]); click(0,0);
  cell(0,0).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
  ok(cell(0,0).isContentEditable,'double-click edits');
  document.execCommand('insertText',false,'!'); equal(rows()[0][0],'A!','native text editing updates model');
  key('Escape'); key('ArrowRight'); equal(selection().active,{row:0,col:1},'navigation after editing');
  key('q'); ok(cell(0,1).isContentEditable,'typing starts editing');
  document.execCommand('insertText',false,'q'); equal(rows()[0][1],'q','typing replaces selected cell'); key('Escape');
  const stable=selection(); document.getElementById('toolbar-button').focus(); equal(selection(),stable,'toolbar focus preserves range');
  tableTools.insertTableRow('below'); equal(rows().length,3,'toolbar insert row');
  tableTools.deleteCurrentTableRow(); equal(rows().length,2,'toolbar delete row');
  tableTools.insertTableColumn('right'); equal(rows()[0].length,3,'toolbar insert column');
  tableTools.deleteCurrentTableColumn(); equal(rows()[0].length,2,'toolbar delete column');
  let saved;
  const fetchOriginal=window.fetch;
  window.fetch=async(url,options)=>{if(url==='/api/save'){saved=JSON.parse(options.body);return {ok:true};} return fetchOriginal(url,options);};
  reset([['A'],['']]); await window.saveWYSIWYGFile('fixture.csv'); equal(saved.content,'A\n\n','save retains blank final row');
  ok(!window.NodevisionState.fileIsDirty,'save clears dirty state'); window.fetch=fetchOriginal;
  // Repeated pointer moves must not scan/rebuild the table, publish toolbar state, or mutate/history-record data.
  reset(Array.from({length:1200},(_,r)=>Array.from({length:30},(_,c)=>`${r}:${c}`)));
  click(0,0); pointer('pointerdown',1,1);
  const originalQuery=Element.prototype.querySelectorAll, originalRect=Element.prototype.getBoundingClientRect;
  const innerHTML=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  let scans=0, rebuilds=0, geometry=0; const toolbarBefore=window.toolbarUpdates, recordsBefore=records, attentionBefore=attentionUpdates;
  Element.prototype.querySelectorAll=function(...args){scans++;return originalQuery.apply(this,args);};
  Element.prototype.getBoundingClientRect=function(...args){geometry++;return originalRect.apply(this,args);};
  Object.defineProperty(Element.prototype,'innerHTML',{...innerHTML,set(value){rebuilds++;innerHTML.set.call(this,value);}});
  for(let i=2;i<202;i++) pointer('pointermove',i,20);
  equal(scans,0,'no whole-table queries on selection pointermove'); equal(rebuilds,0,'no rebuilds on selection pointermove');
  equal(attentionUpdates,attentionBefore,'no attention publication on selection pointermove');
  equal(window.toolbarUpdates,toolbarBefore,'no toolbar publication on selection pointermove'); equal(records,recordsBefore,'no mutation on selection pointermove');
  ok(geometry<=800,'constant geometry reads per selection pointermove');
  pointer('pointerup',201,20); pointer('pointerdown',1,1);
  scans=rebuilds=geometry=0; const moveToolbarBefore=window.toolbarUpdates, moveAttentionBefore=attentionUpdates;
  for(let i=2;i<202;i++) pointer('pointermove',i,2);
  equal(scans,0,'no scans on move pointermove'); equal(rebuilds,0,'no rebuilds on move pointermove');
  equal(attentionUpdates,moveAttentionBefore,'no attention publication on move pointermove');
  equal(window.toolbarUpdates,moveToolbarBefore,'no toolbar publication on move pointermove'); equal(records,recordsBefore,'no mutation on move pointermove');
  ok(geometry<=800,'constant geometry reads per move pointermove');
  Element.prototype.querySelectorAll=originalQuery; Element.prototype.getBoundingClientRect=originalRect; Object.defineProperty(Element.prototype,'innerHTML',innerHTML);
  pointer('pointerup',201,2); equal(records,recordsBefore+1,'large move commits once');
  container.__cleanupCSVTableToolbar(); unsubscribe(); ok(!window.__nvCsvTableContext,'cleanup releases context');
  document.getElementById('result').textContent=`PASS: CSV browser regressions; 36,000 declared cells, 200 selection previews and 200 move previews; zero pointer scans/rebuilds/publications/mutations.`;
} catch(error) { document.getElementById('result').textContent=`FAIL: ${error.stack}`; }

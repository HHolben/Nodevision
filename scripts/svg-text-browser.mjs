// Nodevision/scripts/svg-text-browser.mjs
// This browser regression exercises text insertion and editing against the production SVG editor and Chromium's native text geometry.
try {
  window.NodevisionState={currentMode:'SVG Editing'};
  const base='/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/';
  const {renderEditor}=await import(base+'SVGeditorRuntime.mjs');
  const {insertTextBox}=await import('/ToolbarJSONfiles/svgTextBoxWidget.mjs');
  const {createCursorFamilyProvider}=await import('/CursorFamilies/providers/SVGCursorProvider.mjs');
  const {readTextModel,boundaries}=await import(base+'SvgTextModel.mjs');
  const host=document.getElementById('editor'),dispose=await renderEditor('fixture.svg',host);
  const ctx=window.SVGEditorContext, root=ctx.svgRoot;
  let checks=0;
  const ok=(v,label)=>{checks++;if(!v)throw Error(label);};
  const frame=()=>new Promise(r=>setTimeout(r,35));
  const load=markup=>{ctx.setMode('select');ctx.setEditorHTML(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><g data-layer="true">${markup}</g></svg>`);return root.querySelector('text');};
  const provider=createCursorFamilyProvider();
  const activate=()=>provider.activateTool('text-caret');
  const input=()=>host.querySelector('textarea[aria-label="Edit SVG text"]');
  const point=(el,index)=>{const p=el.getStartPositionOfChar(index);return new DOMPoint(p.x,p.y-3).matrixTransform(el.getScreenCTM());};
  const pointer=(el,type,p)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,pointerId:4,clientX:p.x,clientY:p.y}));
  const click=(el,index)=>{const p=point(el,index);pointer(el,'pointerdown',p);pointer(el,'pointerup',p);};
  const type=text=>{input().setRangeText(text,input().selectionStart,input().selectionEnd,'end');input().dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));};
  const key=(key,extras={})=>input().dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key,...extras}));
  load('<rect id="legitimate" width="20" height="20"/>');
  const text=ctx.recordSvgSnapshot('insert-text',()=>insertTextBox(ctx,{text:'Hello World',fontFamily:'Arial',fontSize:24,textColor:'#000'}));
  ok(text.localName==='text','textbox inserts text directly');
  ok(root.querySelectorAll('rect:not([data-nv-editor-ui])').length===1,'no unwanted rectangle');
  ctx.setSelection([text]); const saved=ctx.getEditorHTML();
  ok(!saved.includes('selection-box'),'selection not serialized');
  ctx.setEditorHTML(saved); let el=root.querySelector('text');
  ok(el.textContent==='Hello World','save/reload text');
  click(el,6); ok(input().hidden,'pointer tool does not edit');
  activate(); ok(provider.getActiveToolId()==='text-caret','cursor provider active tool');
  click(el,6); ok(input().selectionStart===6,'native glyph hit testing');
  type('brave '); ok(el.textContent==='Hello brave World','insert at caret');
  pointer(el,'pointerdown',point(el,12));
  const end=el.getEndPositionOfChar(el.getNumberOfChars()-1),screen=new DOMPoint(end.x,end.y-3).matrixTransform(el.getScreenCTM());
  pointer(root,'pointermove',screen);pointer(root,'pointerup',screen);
  ok(input().value.slice(input().selectionStart,input().selectionEnd)==='World','drag selects word');
  type('Earth');ok(el.textContent==='Hello brave Earth','replace selection');
  key('z',{ctrlKey:true});ok(root.querySelector('text').textContent==='Hello brave World','undo replacement separately');
  ctx.redo();ok(root.querySelector('text').textContent==='Hello brave Earth','redo replacement');
  for (const transform of ['rotate(35 50 80)','translate(80 20) scale(1.7 .8)']) {
    el=load(`<g transform="${transform}"><text x="50" y="80" font-size="24">Hello World</text></g>`);activate();click(el,6);
    ok(input().selectionStart===6,'transformed caret '+transform); type('X');
    await frame();ok(host.querySelector('[data-nv-editor-ui="text-caret"] line'),'caret drawn');
    ok(el.parentElement.getAttribute('transform')===transform,'transform preserved');
  }
  el=load('<text x="30" y="70">Hello <tspan fill="red" font-weight="bold">World</tspan></text>');activate();click(el,7);type('X');
  ok(el.querySelector('tspan').textContent==='WXorld','styled span edit');ok(el.querySelector('tspan').getAttribute('fill')==='red','style retained');
  el=load('<text x="30" y="70">Hello World</text>');activate();click(el,2);
  const mouseClick=(index,detail)=>{const p=point(el,index);el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail,clientX:p.x,clientY:p.y}));};
  mouseClick(2,2);ok(input().value.slice(input().selectionStart,input().selectionEnd)==='Hello','double click word');
  mouseClick(2,3);ok(input().selectionStart===0 && input().selectionEnd===11,'triple click line');
  click(el,2);const shiftPoint=point(el,8);
  el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,pointerId:4,shiftKey:true,clientX:shiftPoint.x,clientY:shiftPoint.y}));
  pointer(el,'pointerup',shiftPoint);ok(input().selectionStart===2 && input().selectionEnd===8,'Shift click extends selection');
  for (const zoom of [.5,2]) {
    root.style.transform=`scale(${zoom})`;click(el,6);ok(input().selectionStart===6,'zoom hit testing '+zoom);
    await frame();const caret=host.querySelector('[data-nv-editor-ui="text-caret"] line');
    const position=point(el,6);ok(Math.abs(+caret.getAttribute('x1')-position.x)<.1,'zoom caret alignment');
  }
  root.style.transform='';pointer(root,'pointerdown',{x:700,y:450});ok(input().hidden,'empty canvas exits without creation');
  el=load('<text x="30" y="70">Hello</text>');activate();click(el,2);type('\nNew');
  ok(readTextModel(el).value==='He\nNewllo','multiline tspan insertion');
  ok(el.querySelector('tspan').getAttribute('dy')==='1.2em','standard SVG multiline');
  ctx.setMode('select');const multiline=ctx.getEditorHTML();ctx.setEditorHTML(multiline);el=root.querySelector('text');
  ok(readTextModel(el).value==='He\nNewllo','multiline persistence');
  el=load('<text x="30" y="70">A👩‍👩‍👧‍👦éZ</text>');activate();click(el,0);
  input().setSelectionRange(12,12);key('ArrowLeft');ok(input().selectionStart===1,'grapheme navigation');
  key('Delete');ok(el.textContent==='AéZ','grapheme deletion');ok(root.contains(el),'Delete preserves object');
  ok(boundaries('A👩‍👩‍👧‍👦éZ').join(',')==='0,1,12,14,15','Unicode boundaries');
  for(const attrs of ['data-nv-locked="true"','style="display:none"','style="opacity:0"']) {
    el=load(`<g ${attrs}><text x="30" y="70">Locked</text></g>`);activate();
    pointer(el,'pointerdown',{x:30,y:70});ok(input().hidden,'locked/hidden rejects '+attrs);
  }
  el=load('<text x="30" y="70"><textPath href="#path">Advanced</textPath></text>');activate();pointer(el,'pointerdown',{x:30,y:70});
  ok(input().hidden && el.querySelector('textPath'),'advanced layout safe fallback');
  el=load('<text x="30" y="70">Text</text>');activate();click(el,1);type('Y');ctx.setMode('rectangle');
  ok(input().hidden,'tool switching ends editing');ok(provider.getActiveToolId()==='rectangle-draw','drawing tool remains available');
  ok(!ctx.getEditorHTML().includes('text-caret'),'caret never serialized');
  if (window.nativeTestInput) {
    let id=0; const pending=new Map();
    window.nativeInputDone=id=>{pending.get(id)();pending.delete(id);};
    const send=(method,params)=>new Promise(resolve=>{pending.set(++id,resolve);window.nativeTestInput(JSON.stringify({id,method,params}));});
    const nativeKey=async(key,code,modifiers=0)=>{
      await send('Input.dispatchKeyEvent',{type:'keyDown',key,windowsVirtualKeyCode:code,modifiers,...(key==='Enter'?{text:'\r'}:{})});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key,windowsVirtualKeyCode:code,modifiers});
    };
    el=load('<text x="30" y="70">Hello World</text>');activate();click(el,6);
    await send('Input.insertText',{text:'native '});ok(el.textContent==='Hello native World','native keyboard insertion');
    await nativeKey('a',65,2);ok(input().selectionEnd===18 && input().selectionStart===0,'native Ctrl+A selects text');
    await nativeKey('c',67,2);await nativeKey('x',88,2);ok(el.textContent==='','native clipboard cut');
    await nativeKey('v',86,2);ok(el.textContent==='Hello native World','native clipboard paste');
    await nativeKey('Home',36,2);ok(input().selectionStart===0,'native Ctrl+Home');
    await nativeKey('End',35,2);ok(input().selectionStart===18,'native Ctrl+End');
    await nativeKey('Enter',13);await send('Input.insertText',{text:'Second'});
    ok(readTextModel(el).value==='Hello native World\nSecond','native Enter multiline');
    await nativeKey('Home',36);ok(input().selectionStart===19,'native line Home');
    await nativeKey('ArrowUp',38);ok(input().selectionStart===0,'native Up line navigation');
    await nativeKey('End',35,8);ok(input().selectionEnd===18 && input().selectionStart===0,'native Shift+End');
    let saveSeen=false;const save=e=>{if(e.ctrlKey && e.key==='s'){saveSeen=true;e.preventDefault();}};
    document.addEventListener('keydown',save);await nativeKey('s',83,2);document.removeEventListener('keydown',save);
    ok(saveSeen,'Ctrl+S propagates to application save');
    await nativeKey('End',35,2);await send('Input.insertText',{text:' '});await send('Input.insertText',{text:'more'});
    ok(el.textContent.endsWith('Second more'),'typing through trailing whitespace');
    await nativeKey('Escape',27);ok(input().hidden,'native Escape');
  }
  dispose();ok(!host.querySelector('textarea'),'input cleaned up');
  document.getElementById('result').textContent=`PASS: ${checks} SVG text checks`;
} catch(error) {document.getElementById('result').textContent='FAIL: '+error.stack;}

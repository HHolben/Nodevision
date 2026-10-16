// Real editor interaction regression: production pointer/keyboard handlers, SVG
// CTMs, external selection chrome, history, and production save/reload paths.
try {
  window.NodevisionState = {};
  const { renderEditor } = await import('/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs');
  const host = document.getElementById('editor');
  const dispose = await renderEditor('fixture.svg', host);
  const ctx = window.SVGEditorContext, root = ctx.svgRoot;
  let checks = 0;
  const ok = (value, label) => { checks++; if (!value) throw Error(label); };
  const near = (a,b,label) => ok(Math.abs(a-b)<.003, `${label}: ${a} != ${b}`);
  const frame = () => new Promise(resolve=>setTimeout(resolve,30));
  const points = el => {
    const b = el.getBBox(), m = root.getScreenCTM().inverse().multiply(el.getScreenCTM());
    return [[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(([x,y]) => new DOMPoint(x,y).matrixTransform(m));
  };
  const center = p => ({x:(p[0].x+p[2].x)/2,y:(p[0].y+p[2].y)/2});
  const rotated = (p,c,deg) => {
    const a=deg*Math.PI/180, x=p.x-c.x, y=p.y-c.y;
    return {x:c.x+x*Math.cos(a)-y*Math.sin(a),y:c.y+x*Math.sin(a)+y*Math.cos(a)};
  };
  const same = (a,b,label) => a.forEach((p,i)=>{near(p.x,b[i].x,label+' x'+i);near(p.y,b[i].y,label+' y'+i);});
  const invariant = (before,after,c,deg,label) => {
    same(after,before.map(p=>rotated(p,c,deg)),label+' rigid vertices');
    const edges=p=>p.map((a,i)=>({x:p[(i+1)%4].x-a.x,y:p[(i+1)%4].y-a.y}));
    const a=edges(before), b=edges(after), length=e=>Math.hypot(e.x,e.y);
    b.forEach((e,i)=>near(length(e),length(a[i]),label+' side '+i));
    const unit=b.map(e=>({x:e.x/length(e),y:e.y/length(e)}));
    for(let i=0;i<4;i++) {
      near(unit[i].x*unit[(i+1)%4].x+unit[i].y*unit[(i+1)%4].y,0,label+' perpendicular');
      near(unit[i].x*unit[(i+2)%4].y-unit[i].y*unit[(i+2)%4].x,0,label+' parallel');
    }
    same([center(after)],[rotated(center(before),c,deg)],label+' center');
  };
  const emit = (target,type,p,shiftKey=false) => {
    const q = new DOMPoint(p.x,p.y).matrixTransform(root.getScreenCTM());
    target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:17,button:0,buttons:type==='pointerup'?0:1,clientX:q.x,clientY:q.y,shiftKey}));
  };
  const key = key => host.querySelector('[tabindex]').dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  const load = (shape, parent='') => {
    ctx.setEditorHTML(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><g id="layer-a" data-layer="true" transform="${parent}">${shape}</g><g id="layer-b" data-layer="true"/></svg>`);
    return root.querySelector('#r');
  };
  const geometry = el => [...el.attributes].filter(a=>a.name!=='transform').map(a=>[a.name,a.value]);
  async function drag(el,mode,degrees,pivot=null,finish='commit') {
    ctx.setMode(mode==='shift'?'select':'rotate'); ctx.setSelection([el]);
    const before=points(el), c=pivot||center(before), shape=JSON.stringify(geometry(el));
    const midpoint=center(before);
    const start={x:midpoint.x+(before[1].x-before[0].x)/4,y:midpoint.y+(before[1].y-before[0].y)/4};
    emit(el,'pointerdown',start,mode==='shift');
    for(const deg of degrees) {
      emit(root,'pointermove',rotated(start,c,deg),mode==='shift');
      invariant(before,points(el),c,deg,mode+' '+deg);
      ok(JSON.stringify(geometry(el))===shape,'rotation preserves primitive attributes');
      await frame();
      const box=host.querySelector('[data-nv-editor-ui="selection-box"]');
      const p=points(el);
      near(+box.getAttribute('x')+3,Math.min(...p.map(q=>q.x)),'overlay x');
      near(+box.getAttribute('width')-6,Math.max(...p.map(q=>q.x))-Math.min(...p.map(q=>q.x)),'overlay width');
    }
    emit(root,finish==='cancel-pointer'?'pointercancel':'pointerup',rotated(start,c,degrees.at(-1)),mode==='shift');
    if(mode!=='shift') key(finish==='cancel'?'Escape':'Enter');
    if(finish==='commit') invariant(before,points(el),c,degrees.at(-1),'released');
    else same(points(el),before,'canceled');
    return before;
  }
  for(const mode of ['shift','rotate']) for(const [w,h] of [[100,50],[30,150],[80,80]]) {
    for(const [base,parent] of [
      ['', ''], ['translate(40 20) rotate(17) scale(2 1)',''],
      ['','translate(40 20) rotate(17) scale(2 1)'],
      ['translate(10 5) scale(.5 2)','translate(40 20) rotate(-12) scale(2 1)']
    ]) {
      let el=load(`<rect id="r" x="30" y="40" width="${w}" height="${h}" transform="${base}"/>`,parent);
      const before=await drag(el,mode,[15,30,45,90,30]);
      const after=points(el);
      ctx.undo(); same(points(root.querySelector('#r')),before,'undo');
      ctx.redo(); same(points(root.querySelector('#r')),after,'redo');
      const saved=ctx.getEditorHTML();
      ok(!saved.includes('data-nv-editor-ui'),'save excludes overlay');
      ctx.setEditorHTML(saved); el=root.querySelector('#r');
      same(points(el),after,'save/reopen');
      ok(el.tagName==='rect','rect remains rect');
      await drag(el,mode,[-30]); same(points(el),before,'+30/-30');
      for(let i=0;i<4;i++) await drag(el,mode,[90]);
      same(points(el),before,'four quarter turns');
    }
  }
  for(const mode of ['shift','rotate']) {
    let el=load('<rect id="r" x="30" y="40" width="100" height="50" data-nv-rotation-origin-x="30" data-nv-rotation-origin-y="40"/>','translate(40 20) scale(2 1)');
    await drag(el,mode,[15,30],points(el)[0]);
    el=load('<rect id="r" width="100" height="50"/>');
    await drag(el,mode,[45],null,mode==='shift'?'cancel-pointer':'cancel');
  }
  // Other primitives share the same transform operation, including transformed lines.
  for(const shape of ['<ellipse id="r" cx="80" cy="70" rx="50" ry="25"/>','<path id="r" d="M30 40h100v50H30z"/>','<line id="r" x1="30" y1="40" x2="130" y2="90"/>']) {
    const el=load(shape,'translate(40 20) scale(2 1)');
    await drag(el,'shift',[15,30,45,90]);
  }
  // Nested transforms, repeated previews, and many committed reversals.
  let stress=load('<g transform="translate(12 8) scale(.5 2)"><rect id="r" x="30" y="40" width="100" height="50"/></g>','translate(40 20) rotate(23) scale(2 1)');
  const original=points(stress);
  await drag(stress,'rotate',Array.from({length:40},(_,i)=>(i+1)*2));
  await drag(stress,'rotate',[-80]);
  for(let i=0;i<20;i++) {
    ctx.setMode('select'); ctx.setSelection([stress]);
    key('r'); key('d'); key('3'); key('0'); if(i%2) key('-'); key('Enter');
  }
  same(points(stress),original,'repeated rotations do not accumulate distortion');
  const collapsed=load('<rect id="r" width="100" height="50"/>','scale(0 1)');
  ctx.setMode('select'); ctx.setSelection([collapsed]); const unchanged=ctx.getEditorHTML();
  key('r'); key('d'); key('3'); key('0'); key('Enter');
  ok(ctx.getEditorHTML()===unchanged,'singular ancestor rejects rotation without invalid transforms');
  // Keyboard rotation supports a shared pivot across selections in different layers.
  load('<rect id="r" x="30" y="40" width="100" height="50"/>','scale(2 1)');
  root.querySelector('#layer-b').innerHTML='<rect id="s" x="300" y="100" width="30" height="70" transform="rotate(15 315 135)"/>';
  const elements=[root.querySelector('#r'),root.querySelector('#s')], before=elements.map(points);
  const all=before.flat(), c={x:(Math.min(...all.map(p=>p.x))+Math.max(...all.map(p=>p.x)))/2,y:(Math.min(...all.map(p=>p.y))+Math.max(...all.map(p=>p.y)))/2};
  ctx.setMode('select'); ctx.setSelection(elements); key('r'); key('d'); key('3'); key('0');
  elements.forEach((el,i)=>invariant(before[i],points(el),c,30,'multi preview')); key('Enter');
  const after=elements.map(points); ctx.undo();
  ['r','s'].forEach((id,i)=>same(points(root.querySelector('#'+id)),before[i],'multi undo'));
  ctx.redo(); ctx.setEditorHTML(ctx.getEditorHTML());
  ['r','s'].forEach((id,i)=>same(points(root.querySelector('#'+id)),after[i],'multi redo/reopen'));
  dispose();
  document.getElementById('result').textContent=`PASS: ${checks} rotation geometry, pointer preview/release, chrome, history and SVG round-trip assertions`;
} catch(e) {document.getElementById('result').textContent='FAIL: '+e.stack;}

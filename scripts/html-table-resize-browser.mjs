const output = document.getElementById('result');
const errors = [], checks = [], saves = [];
window.addEventListener('error', e => { errors.push(e.message); e.preventDefault(); });
const ok = (value, label) => { if (!value) throw Error(label); };
const near = (a,b,label,tolerance=2) => ok(Math.abs(a-b)<tolerance, `${label}: ${a} vs ${b}`);
const delay = () => new Promise(resolve => setTimeout(resolve, 20));
try {
  window.NodevisionState = {};
  const { renderEditor } = await import('/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs');
  const originalFetch = window.fetch.bind(window);
  window.fetch = (url, options) => String(url).startsWith('/Notebook/') ? Promise.resolve(new Response('<p>fixture</p>'))
    : url === '/api/save' ? (saves.push(JSON.parse(options.body)), Promise.resolve(Response.json({success:true}))) : originalFetch(url, options);
  const host = document.getElementById('editor');
  let cleanup = await renderEditor('table.html', host);
  let context = host.__nvHtmlEditorContext, root = context.editorElement;
  const fixture = (content='text', extra='') => `<table style="border-collapse:collapse;${extra}"><tr><td style="width:120px;height:60px;padding:6px;color:red">${content}</td><td style="width:140px">other</td><td style="width:100px">last</td></tr><tr><td>bottom</td><td></td><td>end</td></tr></table>`;
  const load = html => { context.setHTML('<!doctype html><html><body>'+html+'</body></html>'); context.activate(); };
  function begin(kind, cell=root.querySelector('td'), edge='end') {
    const rect = cell.getBoundingClientRect();
    const x = kind==='column' ? (edge==='end' ? rect.right-.5 : rect.left+.5) : rect.left+rect.width/2;
    const y = kind==='row' ? (edge==='end' ? rect.bottom-.5 : rect.top+.5) : rect.top+rect.height/2;
    cell.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,pointerId:1,clientX:x,clientY:y}));
    ok(context.transactions.pending,'transaction opened');
    return {
      move(delta) { window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:x+(kind==='column'?delta:0),clientY:y+(kind==='row'?delta:0)})); },
      end(type='pointerup') { window.dispatchEvent(new PointerEvent(type,{pointerId:1})); },
    };
  }
  for (const zoom of [.5,1,1.75]) for (const kind of ['column','row']) {
    load(fixture()); root.style.transformOrigin='0 0'; root.style.transform=`scale(${zoom})`;
    const table=root.querySelector('table'), cell=table.rows[0].cells[0];
    const size=()=>cell.getBoundingClientRect()[kind==='column'?'width':'height']/zoom;
    const other=kind==='column'? table.rows[0].cells[1]:table.rows[1];
    const otherSize=()=>other.getBoundingClientRect()[kind==='column'?'width':'height']/zoom;
    const original=size(), unrelated=otherSize(), before=context.getHTML();
    const history=root.__nvProgrammaticHistory, count=history.inspect().undoEntries;
    const drag=begin(kind);
    for(const delta of [.5,8,25,100,350,700]) {
      drag.move(delta*zoom); await delay();
      near(size(),original+delta,`${kind} continues tracking at zoom ${zoom}`);
      near(otherSize(),unrelated,'unrelated track stable');
      ok(root.querySelector('table')===table,'no DOM replacement');
    }
    drag.move(0); near(size(),original,'return to drag origin');
    drag.move(50*zoom); near(size(),original+50,'reverse direction');
    drag.end();
    ok(!context.transactions.pending,'gesture settled');
    ok(history.inspect().undoEntries===count+1,'one history entry');
    const after=context.getHTML(); history.undo(); ok(context.getHTML()===before,'undo exact source');
    history.redo(); ok(context.getHTML()===after,'redo exact source');
    checks.push(`${kind}: slow/rapid, outside bounds, reverse, zoom ${zoom}, history`);
  }
  root.style.transform='';
  for(const content of ['','wrapping text '.repeat(12),'<img width="90" height="70" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2290%22 height=%2270%22/%3E">']) for(const kind of ['column','row']) {
    load(fixture(content)); const table=root.querySelector('table'), cell=table.rows[0].cells[0];
    const prop=kind==='column'?'width':'height';
    const other=kind==='column'?table.rows[0].cells[1]:table.rows[1];
    const otherSize=other.getBoundingClientRect()[prop];
    const drag=begin(kind); drag.move(-1000); await delay();
    const minimum=cell.getBoundingClientRect()[prop];
    near(other.getBoundingClientRect()[prop],otherSize,'unrelated track stable at minimum');
    ok(minimum>=12, 'padding minimum retained');
    if(content.startsWith('<img')) ok(minimum >= (kind==='column'?90:70)+12,'image minimum retained');
    drag.move(-2000); near(cell.getBoundingClientRect()[prop],minimum,'legitimate minimum stable');
    drag.move(250); drag.end();
    ok(cell.getBoundingClientRect()[prop]>minimum,'resize recovers after minimum');
  }
  checks.push('empty/text/image intrinsic minimums and recovery');
  for(const kind of ['column','row']) {
    load(fixture('x', 'table-layout:auto'));
    const cell=root.querySelector('td'); cell.style[kind==='column'?'minWidth':'minHeight']='95px';
    const drag=begin(kind); drag.move(-1000); ok(cell.getBoundingClientRect()[kind==='column'?'width':'height']>=95,'authored minimum retained'); drag.end();
    ok(root.querySelector('table').style.tableLayout==='auto','table layout preserved');
  }
  checks.push('authored CSS minimums and table-layout preserved');
  const merged='<table style="border-collapse:collapse"><tr><td colspan="2" style="width:240px;height:45px"><b>merged</b></td><td rowspan="2" style="width:100px">span</td></tr><tr><td style="width:100px;height:40px">a</td><td style="width:140px">b</td></tr><tr><td>x</td><td>y</td><td>z</td></tr></table>';
  for(const kind of ['column','row']) {
    load(merged);const table=root.querySelector('table'), target=kind==='column'?table.rows[1].cells[0]:table.rows[0].cells[0];
    const prop=kind==='column'?'width':'height', before=target.getBoundingClientRect()[prop];
    const drag=begin(kind,target); drag.move(150); near(target.getBoundingClientRect()[prop],before+150,'merged track'); drag.end();
    ok(table.querySelector('[colspan="2"] b') && table.querySelector('[rowspan="2"]'),'merged contents and spans retained');
  }
  checks.push('colspan and rowspan sizing');
  for (const html of [fixture('text','border-collapse:separate;border-spacing:5px;'), fixture('text','table-layout:fixed;'), fixture('text','border:3px solid black;'), fixture().replace('<tr>', '<colgroup><col style="width:120px"><col style="width:140px"><col style="width:100px"></colgroup><tr>'), merged]) {
    load(html); const table=root.querySelector('table'), target=table.rows[0].cells[1];
    const left=table.rows[0].cells[0], before=left.getBoundingClientRect().width, other=target.getBoundingClientRect().width;
    const drag=begin('column',target,'start');drag.move(100);
    near(left.getBoundingClientRect().width,before+100,'left-side boundary and existing layout');
    near(target.getBoundingClientRect().width,other,'adjacent cell unchanged');drag.end();
  }
  checks.push('left edge, separate borders, fixed layout and colgroup');
  for(const end of ['pointercancel','Escape']) {
    load(fixture());const before=context.getHTML(), drag=begin('column');drag.move(100);
    if(end==='Escape') window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',cancelable:true}));else drag.end(end);
    ok(!context.transactions.pending && !root.classList.contains('nv-table-divider-resizing'),'cancel state cleaned');
    ok(context.getHTML()===before,'cancel restores source');
    const next=begin('row');next.move(40);next.end();
  }
  checks.push('pointercancel/Escape restore and next drag');
  load(fixture());const beforeClick=context.getHTML();begin('column').end();ok(context.getHTML()===beforeClick,'click is no-op');
  const drag=begin('column');drag.move(180);drag.end();
  const row=begin('row');row.move(80);row.end();
  const saved=context.getHTML();await context.save();ok(saves.at(-1).content===saved,'save uses final dimensions');
  cleanup();cleanup=await renderEditor('table.html',host);context=host.__nvHtmlEditorContext;root=context.editorElement;
  context.setHTML(saves.at(-1).content);ok(context.getHTML()===saved,'reopened source keeps dimensions');
  checks.push('save and reopen');
  window.nativeResize = {
    prepare(kind, zoom) {
      load(fixture());root.style.transformOrigin='0 0';root.style.transform=`scale(${zoom})`;
      const cell=root.querySelector('td'), rect=cell.getBoundingClientRect();
      const before=kind==='column'?rect.width:rect.height;
      this.state={kind,zoom,cell,before,source:context.getHTML()};
      return { x:kind==='column'?rect.right-.5:rect.left+rect.width/2,
        y:kind==='row'?rect.bottom-.5:rect.top+rect.height/2 };
    },
    check(delta) {
      ok(root.hasPointerCapture(1),'native pointer capture retained '+JSON.stringify({pending:context.transactions.pending,cls:root.className,errors}));
      const {kind,cell,before}=this.state;
      near(cell.getBoundingClientRect()[kind==='column'?'width':'height'],before+delta,'native boundary follows pointer');
      ok(root.classList.contains('nv-table-divider-resizing'),'hover does not clear active state');
    },
    finish() { ok(!context.transactions.pending && !root.hasPointerCapture(1),'native release settles');ok(!errors.length,errors.join('; ')); },
    cleanup() { cleanup(); }
  };
  ok(!errors.length,errors.join('; '));
  output.textContent='PASS: '+checks.join('\n');
} catch(e) { output.textContent='FAIL: '+e.stack+'\n'+errors.join('; '); }

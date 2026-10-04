// Additional native structural, command, selection, and revision-boundary acceptance checks.
module.exports = async ({ win, js, key, type, delay }) => {
  const checks = [];
  const reset = () => js('historyExperiment.reset({instrument:false})');
  const assert = async (expression, label) => { if (!await js(expression)) throw new Error(label); checks.push(label); };
  await reset(); await type('ABC');
  await js(`(() => {const c=foundation.contexts[0], r=document.createRange(), n=c.editorElement.querySelector('#text').firstChild;r.setStart(n,1);r.setEnd(n,3);getSelection().removeAllRanges();getSelection().addRange(r);c.selection.capture();})()`);
  win.webContents.cut(); await delay(100);
  await assert('foundation.contexts[0].editorElement.querySelector("#text").textContent === "xC"', 'native cut');
  await key('Z',['control']);
  await assert('foundation.contexts[0].editorElement.querySelector("#text").textContent === "xABC" && getSelection().toString() === "AB"', 'cut undo restores selection');
  await js('document.execCommand("bold")');
  await assert('!!foundation.contexts[0].editorElement.querySelector("b, strong")','native formatting command recorded');
  await key('Z',['control']);
  await assert('!foundation.contexts[0].editorElement.querySelector("b, strong") && getSelection().toString() === "AB"','formatting undo restores selection');
  await key('Z',['control','shift']);
  await assert('!!foundation.contexts[0].editorElement.querySelector("b, strong")','formatting redo');
  await reset();
  await js(`foundation.contexts[0].transactions.run('fragments',()=>{foundation.contexts[0].editorElement.querySelector('#text').innerHTML='one <em>two</em> three';})`);
  await js(`(() => {const c=foundation.contexts[0], p=c.editorElement.querySelector('#text'), r=document.createRange();r.setStart(p.firstChild,2);r.setEnd(p.lastChild,3);getSelection().removeAllRanges();getSelection().addRange(r);c.selection.capture();window.journalSelectedText=getSelection().toString();})()`);
  await key('Backspace'); await key('Z',['control']);
  await assert('foundation.contexts[0].editorElement.querySelector("#text").innerHTML === "one <em>two</em> three" && getSelection().toString() === journalSelectedText', 'multi-node deletion and selection replay');
  await reset(); await type('A'); await key('Z',['control']);
  await js('foundation.contexts[0].transactions.run("noop",()=>{})'); await key('Z',['control','shift']);
  await assert('foundation.contexts[0].editorElement.querySelector("#text").textContent === "xA"','no-op preserves redo');
  await key('Z',['control']);
  await js('(()=>{const c=foundation.contexts[0], t=c.transactions.begin("cancel");t.preview(()=>c.editorElement.querySelector("#text").style.color="red");t.cancel();})()');
  await key('Z',['control','shift']);
  await assert('foundation.contexts[0].editorElement.querySelector("#text").textContent === "xA"','cancel preserves redo');
  await js('foundation.contexts[0].editorElement.querySelector("#text").setAttribute("title","unclassified")'); await delay(20);
  await key('Z',['control']);
  await assert('foundation.contexts[0].editorElement.querySelector("#text").textContent === "xA" && !foundation.contexts[0].editorElement.__nvProgrammaticHistory.canUndo()','unclassified authored mutation invalidates replay');
  await reset();
  await js('window.journalPreview=foundation.contexts[0].transactions.begin("preview before IME"); journalPreview.preview(()=>foundation.contexts[0].editorElement.querySelector("#text").style.color="red")');
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Input.imeSetComposition',{text:'に',selectionStart:1,selectionEnd:1});
  await win.webContents.debugger.sendCommand('Input.insertText',{text:'日本'}); await delay(100);
  await assert('!foundation.contexts[0].transactions.pending && !foundation.contexts[0].editorElement.querySelector("#text").style.color', 'composition cancels open preview');
  await key('Z',['control']);
  await assert('foundation.contexts[0].editorElement.querySelector("#text").textContent === "x"','composition after preview undo');
  win.webContents.debugger.detach();
  await js(`(async()=>{
    const {createHtmlDomHistory}=await import('/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.mjs');
    const root=document.createElement('div');root.textContent='0';document.body.append(root);
    const h=createHtmlDomHistory(root,{maxEntries:2,maxBytes:500});
    for(let i=1;i<=4;i++){h.beginTransaction();root.firstChild.data=String(i);h.record();}
    if(h.inspect().undoEntries!==2)throw new Error('entry eviction');
    h.undo();h.undo();h.undo();if(root.textContent!=='2')throw new Error('eviction order');
    h.redo();h.redo();if(root.textContent!=='4')throw new Error('redo after eviction');
    h.beginTransaction();root.firstChild.data='x'.repeat(1000);h.record();
    if(h.inspect().retainedBytes>500 || h.canUndo())throw new Error('oversized entry eviction');
    h.dispose();root.remove();
  })()`); checks.push('entry and byte limits with replay after eviction');
  await reset();
  await js(`(async()=>{
    const c=foundation.contexts[0],root=c.editorElement,h=root.__nvProgrammaticHistory;
    const {htmlHistoryNeedsPresentation}=await import('/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryRestore.mjs');
    for(const className of ['nv-inline-equation','nodevision-circuit-reference','nv-layout-canvas']){
      const widget=document.createElement('div');widget.className=className;
      if(!htmlHistoryNeedsPresentation([{kind:'children',node:root,added:[widget],removed:[]}]))throw new Error('widget restoration classification: '+className);
    }
    c.transactions.run('layout widget',()=>{const widget=document.createElement('div');widget.className='nv-layout-canvas';widget.id='journal-widget';widget.style.width='100px';root.append(widget);});
    h.undo();if(root.querySelector('#journal-widget'))throw new Error('widget insertion undo');
    h.redo();if(!root.querySelector('#journal-widget'))throw new Error('widget insertion redo');
    c.transactions.run('widget width',()=>root.querySelector('#journal-widget').style.width='150px');
    h.undo();if(root.querySelector('#journal-widget').style.width!=='100px')throw new Error('widget width undo');
    h.redo();if(root.querySelector('#journal-widget').style.width!=='150px')throw new Error('widget width redo');
    if(document.activeElement!==root)throw new Error('widget replay focus');
  })()`);
  checks.push('layout widget insertion and width Undo/Redo; equation/circuit conservative classification');
  return checks;
};

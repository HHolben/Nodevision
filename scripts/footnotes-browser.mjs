// Nodevision/scripts/footnotes-browser.mjs
// This browser regression mounts the real HTML editor to exercise footnote commands, native selection and paste, journal boundaries, persistence, navigation, and large-document reconciliation filtering.
import { noteAnchors, noteDefinitions, NOTE, identity } from '/References/ReferenceModel.mjs';
import { reconcileFootnotes } from '/References/ReconcileFootnotes.mjs';
let checks = 0;
const ok = (value,message) => { if (!value) throw Error(message); checks++; };
const output = document.getElementById('result');
window.NodevisionState = {};
const nativeFetch = window.fetch.bind(window), saves = [], diagnostics = [];
let reloadSource = null;
window.alert = message => diagnostics.push(message);
window.fetch = async (url, options = {}) => {
  const path = String(url);
  if (path.startsWith('/Notebook/')) return new Response(reloadSource || '<!doctype html><html><head><title>Notes</title></head><body><p id="p1">First paragraph.</p><p id="p2">Second paragraph.</p><p id="p3">Third paragraph.</p></body></html>');
  if (path === '/api/save') { saves.push(JSON.parse(options.body)); return Response.json({success:true}); }
  if (path.includes('recent') || path.includes('Recent')) return Response.json({entries:[]});
  return nativeFetch(url,options);
};
try {
  const {renderEditor} = await import('/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs');
  const host = document.getElementById('editor');
  const dispose = await renderEditor('notes.html',host);
  const {default:insertFootnote} = await import('/ToolbarCallbacks/insert/insertFootnote.mjs');
  const menu = await (await nativeFetch('/ToolbarJSONfiles/insertToolbar.json')).json();
  ok(menu.some(item=>item?.heading==='References' && item.parentHeading==='Insert') && menu.some(item=>item?.callbackKey==='insertFootnote' && item.parentHeading==='References'),'Insert References Footnote menu integration');
  const context = host.__nvHtmlEditorContext, root = context.editorElement;
  const history = root.__nvProgrammaticHistory, references = root.__nvReferences;
  ok(references,'real graphical editor owns references');
  const select = (node,start=0,end=start) => {
    root.focus(); const range = document.createRange(); range.setStart(node,start); range.setEnd(node,end);
    const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(range); context.selection.capture(); return range;
  };
  const set = html => { context.setHTML(html); context.activate(); };
  const transaction = (label,action) => context.transactions.run(label,action);
  const refs = () => noteAnchors(root), defs = () => noteDefinitions(root);
  const order = () => refs().map(ref=>ref.textContent).join(',');
  const valid = () => refs().every(ref => defs().some(def=>def.id===ref.getAttribute('href').slice(1) && def.getAttribute(NOTE)===ref.getAttribute(NOTE)));
  const insertAt = (id, offset=2) => { select(root.querySelector('#'+id).firstChild,offset); return insertFootnote(); };
  document.getSelection().removeAllRanges(); context.selection.clear();
  ok(references.insert()===false && !refs().length,'absent selection refused without mutation');
  const first = insertAt('p1');
  document.execCommand('insertText',false,'Initial note');
  ok(first.firstChild.textContent==='Initial note','typing immediately after insertion enters empty note');
  const third = insertAt('p3');
  transaction('Edit rich notes',()=>{first.firstChild.innerHTML='<em>First</em> <strong>note</strong> <a href="https://example.org/">source</a>';const p=document.createElement('p');p.innerHTML='Second paragraph H<sub>2</sub>O and x<sup>2</sup>';first.insertBefore(p,first.lastChild);third.firstChild.textContent='Third note';});
  const ids = [first.getAttribute(NOTE),third.getAttribute(NOTE)];
  const second = insertAt('p2');
  ok(order()==='1,2,3' && defs().map(def=>def.getAttribute('value')).join(',')==='1,2,3','insertion in middle renumbers anchors and saved list values');
  ok(refs()[0].getAttribute(NOTE)===ids[0] && refs()[2].getAttribute(NOTE)===ids[1],'IDs survive renumbering');
  ok(first.querySelectorAll('p').length===2 && first.querySelector('em') && first.querySelector('strong') && first.querySelector('sub'),'rich text retained');
  const p3=root.querySelector('#p3');transaction('Move paragraph',()=>root.insertBefore(p3,root.querySelector('#p1')));
  ok(order()==='1,2,3' && refs()[0].getAttribute(NOTE)===ids[1] && defs()[0].textContent.includes('Third note'),'move renumbers preserving association');
  ok(history.undo() && refs()[2].getAttribute(NOTE)===ids[1] && order()==='1,2,3','one undo restores paragraph and numbering');
  ok(history.redo() && refs()[0].getAttribute(NOTE)===ids[1] && order()==='1,2,3','redo move consistent');
  const reference=refs()[0], destination=defs()[0];
  reference.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  ok(destination.contains(document.getSelection().anchorNode),'click reaches editable note without navigating app');
  const back=destination.querySelector('[role="doc-backlink"]');back.focus();back.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  ok(root.querySelector('#p3').contains(document.getSelection().anchorNode),'keyboard return reaches source paragraph');
  const saved=context.getHTML();await context.save();
  ok(saves.at(-1).content===saved,'real save retains standalone HTML');
  set(saved);ok(valid() && defs().some(def=>def.querySelector('em')) && refs().some(ref=>ref.getAttribute(NOTE)===ids[0]),'source replacement/reopen preserves rich notes and stable identities');
  // Empty selection inserts; a nonempty range is not deleted and gets its reference at the end.
  set('<p id="p1">selected text remains</p>');select(root.firstChild.firstChild,0,8);references.insert();
  ok(root.querySelector('#p1').textContent==='selected1 text remains','selected text preserved with reference at selection end');
  ok(history.undo() && root.querySelector('#p1').textContent==='selected text remains' && !refs().length,'insertion undo atomic');
  ok(history.redo() && refs().length===1 && defs().length===1,'insertion redo atomic');
  select(defs()[0].firstChild,0);ok(references.insert()===false && refs().length===1,'invalid insertion inside note refused');
  // Clipboard uses actual event listeners and browser insertion, not direct model-only calls.
  let range=document.createRange();range.selectNode(refs()[0].closest('sup'));document.getSelection().removeAllRanges();document.getSelection().addRange(range);context.selection.capture();
  const data=new DataTransfer();root.dispatchEvent(new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true}));
  ok(data.getData('text/html').includes('data-nv-clipboard-origin') && data.getData('text/plain')==='1','clipboard carries definitions and plain-text selection');
  select(root.querySelector('#p1'),root.querySelector('#p1').childNodes.length);
  root.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  ok(refs().length===2 && refs()[0].getAttribute(NOTE)===refs()[1].getAttribute(NOTE) && refs()[0].id!==refs()[1].id && defs().length===1,'same-document paste shares definition with unique anchor');
  ok(defs()[0].querySelectorAll('[role="doc-backlink"]').length===2,'shared definition returns to both anchors');
  ok(history.undo() && refs().length===1 && defs().length===1,'one undo reverses paste and backlinks');
  ok(history.redo() && refs().length===2,'redo shared paste');
  range=document.createRange();range.selectNode(refs()[0]);document.getSelection().removeAllRanges();document.getSelection().addRange(range);context.selection.capture();references.remove();
  ok(refs().length===1 && defs().length===1,'explicit shared-anchor deletion retains definition');
  select(defs()[0].firstChild,0);references.remove();ok(!refs().length && !defs().length,'explicit last-anchor deletion removes definition');
  ok(history.undo() && refs().length===1 && defs().length===1,'undo deletion restores both');
  transaction('Ordinary reference deletion',()=>refs()[0].closest('sup').remove());
  ok(!refs().length && defs().length===1 && root.querySelector('[data-nv-note-orphans]'),'ordinary deletion retains recoverable orphan');
  ok(history.undo() && refs().length===1 && !root.querySelector('[data-nv-note-orphans]'),'undo ordinary deletion restores whole apparatus');
  // Cut and paste retains the same note identity while moving the anchor.
  const cutId=refs()[0].getAttribute(NOTE);range=document.createRange();range.selectNode(refs()[0].closest('sup'));document.getSelection().removeAllRanges();document.getSelection().addRange(range);context.selection.capture();
  const cutData=new DataTransfer();root.dispatchEvent(new ClipboardEvent('cut',{clipboardData:cutData,bubbles:true,cancelable:true}));
  ok(!refs().length && defs().length===1,'cut retains recoverable definition');
  select(root.querySelector('#p1'),0);root.dispatchEvent(new ClipboardEvent('paste',{clipboardData:cutData,bubbles:true,cancelable:true}));
  ok(refs().length===1 && refs()[0].getAttribute(NOTE)===cutId && !root.querySelector('[data-nv-note-orphans]'),'cut/paste preserves identity and restores navigation');
  // Imported data with colliding IDs must retain independent content.
  const foreign=new DataTransfer();foreign.setData('text/html',data.getData('text/html').replace(/data-nv-clipboard-origin="[^"]*"/,'data-nv-clipboard-origin="foreign"'));
  select(root.querySelector('#p1'),0);root.dispatchEvent(new ClipboardEvent('paste',{clipboardData:foreign,bubbles:true,cancelable:true}));
  ok(defs().length===2 && new Set(refs().map(ref=>ref.getAttribute(NOTE))).size===2 && new Set([...root.querySelectorAll('[id]')].map(el=>el.id)).size===root.querySelectorAll('[id]').length,'foreign paste remaps note and anchor collisions');
  transaction('Delete definition',()=>defs()[0].remove());ok(valid() && root.querySelector('[data-nv-note-missing]'),'missing definition repaired visibly');
  transaction('Restore missing contents',()=>root.querySelector('[data-nv-note-missing] p').textContent='Restored note');
  ok(!root.querySelector('[data-nv-note-missing]'),'recovered placeholder clears its missing-content diagnostic');
  const malformed='<p><sup><a href="#old" role="doc-noteref">9</a></sup></p><section class="nv-footnotes"><ol><li id="old" role="doc-footnote"><p><i>Imported</i> note</p></li></ol></section>';
  set(malformed);ok(order()==='1' && valid() && defs()[0].querySelector('i'),'missing metadata imported without flattening rich text');
  transaction('Duplicate IDs',()=>root.firstChild.append(refs()[0].parentElement.cloneNode(true)));ok(new Set(refs().map(ref=>ref.id)).size===2 && defs().length===1,'raw duplicate reference IDs repaired');
  set('<p><sup id="legacy-ref"><a href="#footnote-1">7</a></sup></p><footer><h3>Footnotes</h3><ol id="footnotes-list"><li id="footnote-1"><b>Legacy</b> note <a href="#legacy-ref">↩</a></li></ol></footer>');
  ok(order()==='1' && valid() && defs()[0].querySelector('b'),'legacy footnotes migrate with content preserved');
  transaction('Duplicate legacy reference',()=>root.firstChild.append(refs()[0].parentElement.cloneNode(true)));
  ok(new Set([...root.querySelectorAll('[id]')].map(el=>el.id)).size===root.querySelectorAll('[id]').length,'legacy wrapper ID collisions repaired');
  set('<p><sup><a role="doc-noteref" data-nv-note-id="same" href="#one">1</a></sup><sup><a role="doc-noteref" data-nv-note-id="same" href="#two">2</a></sup></p><section class="nv-footnotes"><ol><li id="one" role="doc-footnote" data-nv-note-id="same"><p>One</p></li><li id="two" role="doc-footnote" data-nv-note-id="same"><p>Two</p></li></ol></section>');
  ok(defs().length===2 && new Set(defs().map(d=>d.getAttribute(NOTE))).size===2 && refs()[1].getAttribute('href')==='#two','duplicate definition identities repaired without discarding content or breaking explicit targets');
  ok(root.querySelectorAll('section.nv-footnotes').length===1,'existing standalone collection reused');
  // Large manuscript: ordinary text input must not run the reference scanner.
  const paragraphs=Array.from({length:300},(_,i)=>`<p id="large-${i}">${'manuscript words '.repeat(100)}<sup><a role="doc-noteref" data-nv-note-id="n-${i}" id="r-${i}" href="#d-${i}">${i+1}</a></sup></p>`).join('');
  const notes=Array.from({length:300},(_,i)=>`<li role="doc-footnote" data-nv-note-id="n-${i}" id="d-${i}"><p>Note ${i}</p></li>`).join('');
  set(paragraphs+`<section class="nv-footnotes"><ol>${notes}</ol></section>`);
  ok(refs().length===300 && valid(),'300-footnote manuscript reconciled');
  const scans=references.scans;select(root.querySelector('#large-0').firstChild,3);
  const originalLength=root.querySelector('#large-0').textContent.length;
  const typingStart=performance.now();
  for(let i=0;i<30;i++)document.execCommand('insertText',false,'x');
  const typingMilliseconds=performance.now()-typingStart;
  ok(references.scans===scans && root.querySelector('#large-0').textContent.length===originalLength+30,'ordinary typing changes text without scanning the manuscript');
  const serial=context.getHTML(), detached=new DOMParser().parseFromString(serial,'text/html');
  ok(!detached.querySelector('script') && detached.querySelectorAll('[role="doc-noteref"]').length===300,'saved document has no reference runtime dependency');
  // A separate ordinary document frame has scripts disabled; links must still navigate natively.
  await nativeFetch('/test-standalone',{method:'POST',body:saved});
  const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin');frame.src='/standalone.html';
  await new Promise(resolve=>{frame.onload=resolve;document.body.append(frame);});
  const standalone=frame.contentDocument;
  ok(standalone.querySelectorAll('[role="doc-noteref"]').length===3 && standalone.querySelectorAll('li[role="doc-footnote"]').length===3,'standalone document renders all saved references and definitions with scripts disabled');
  const blockedScript=standalone.createElement('script');blockedScript.textContent='window.__footnoteScriptRan=true';standalone.head.append(blockedScript);
  ok(!frame.contentWindow.__footnoteScriptRan,'standalone frame actually blocks script execution');
  const standaloneRef=standalone.querySelector('[role="doc-noteref"]');standaloneRef.click();
  await new Promise(resolve=>setTimeout(resolve,30));
  ok(frame.contentWindow.location.hash===standaloneRef.getAttribute('href'),'native standalone forward link works without scripts');
  const standaloneNote=standalone.getElementById(frame.contentWindow.location.hash.slice(1));standaloneNote.querySelector('[role="doc-backlink"]').click();
  await new Promise(resolve=>setTimeout(resolve,30));
  ok(frame.contentWindow.location.hash==='#'+standaloneRef.id,'native standalone backlink works without scripts');frame.remove();
  window.__footnoteStandalone=serial;

  references.dispose();select(root.querySelector('#large-0').firstChild,3);
  const baselineStart=performance.now();for(let i=0;i<30;i++)document.execCommand('insertText',false,'y');
  const baselineMilliseconds=performance.now()-baselineStart;
  ok(typingMilliseconds < baselineMilliseconds*4+100,'typing stays within control-run tolerance');
  dispose?.();ok(!root.__nvReferences,'reference listeners and subscription disposed');
  reloadSource=saved;
  const disposeReopened=await renderEditor('notes.html',host);
  const reopened=host.__nvHtmlEditorContext, reopenedRoot=reopened.editorElement;
  ok(noteAnchors(reopenedRoot).length===3 && noteDefinitions(reopenedRoot).some(def=>def.querySelector('em')),'closing and rendering saved document again reconstructs editable footnotes');
  const paragraph=noteDefinitions(reopenedRoot)[0].querySelector('p');
  reopenedRoot.focus();const editRange=document.createRange();editRange.setStart(paragraph.firstChild,paragraph.firstChild.length);editRange.collapse(true);document.getSelection().removeAllRanges();document.getSelection().addRange(editRange);reopened.selection.capture();
  const beforeText=paragraph.textContent;document.execCommand('insertText',false,' revised');
  ok(paragraph.textContent===beforeText+' revised','native editing after actual reopen');
  ok(reopenedRoot.__nvProgrammaticHistory.undo() && paragraph.textContent===beforeText,'undo native note edit');
  ok(reopenedRoot.__nvProgrammaticHistory.redo() && paragraph.textContent===beforeText+' revised','redo native note edit');
  // Explicit deletion of the middle and first definitions renumbers remaining notes.
  reopenedRoot.__nvReferences.navigate(noteDefinitions(reopenedRoot)[1]);reopenedRoot.__nvReferences.remove();
  ok(noteAnchors(reopenedRoot).map(a=>a.textContent).join(',')==='1,2' && noteDefinitions(reopenedRoot).length===2,'delete middle footnote');
  reopenedRoot.__nvReferences.navigate(noteDefinitions(reopenedRoot)[0]);reopenedRoot.__nvReferences.remove();
  ok(noteAnchors(reopenedRoot)[0].textContent==='1' && noteDefinitions(reopenedRoot).length===1,'delete first footnote');
  disposeReopened?.();
  output.textContent=`PASS ${checks} footnote browser checks; 30 edits in 60,000-word/300-note manuscript: ${typingMilliseconds.toFixed(1)} ms (controller disabled: ${baselineMilliseconds.toFixed(1)} ms), zero reconciliation scans`;

} catch(error) { output.textContent='FAIL '+error.stack; }

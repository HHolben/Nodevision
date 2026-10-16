// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgTextCaret.mjs
// This controller integrates direct SVG text editing with the existing tool state and document history. A native textarea owns keyboard input and clipboard operations while separate screen overlays display SVG glyph selection.
import {readTextModel, replaceText, textDiff} from './SvgTextModel.mjs';
import {createTextGeometry} from './SvgTextGeometry.mjs';
export function installSvgTextCaret(session) {
  const abort = new AbortController(), signal = abort.signal;
  const input = document.createElement('textarea');
  input.setAttribute('aria-label', 'Edit SVG text'); input.spellcheck = false; input.wrap = 'off';
  Object.assign(input.style, {position:'fixed', width:'1px', height:'1px', opacity:'0', padding:'0', border:'0', pointerEvents:'none'});
  input.hidden = true; session.wrapper.append(input);
  const geometry = createTextGeometry(session.wrapper);
  let element = null, model = null, before = null, timer = 0, raf = 0, drag = null, anchor = 0;
  function editable(node) {
    if (!node || !session.isSelectableElement(node)) return false;
    for (let p=node; p && p !== session.svgRoot.parentElement; p=p.parentElement) {
      const style=getComputedStyle(p);
      if (style.display === 'none' || style.visibility !== 'visible' || +style.opacity === 0) return false;
    }
    return true;
  }
  function commit() {
    clearTimeout(timer);
    if (before === null) return;
    const old = before, after = session.serializeSvgForSave(); before = null;
    if (old === after) return;
    session.history.pushCustom({kind:'edit-text',
      undo:()=>{session.setSvgFromString(old); return {label:'edit-text'};},
      redo:()=>{session.setSvgFromString(after); return {label:'edit-text'};}});
  }
  function release() {
    if (drag !== null) try {session.svgViewportHost.releasePointerCapture(drag);} catch {}
    drag = null;
  }
  function finish() {
    commit(); release(); cancelAnimationFrame(raf); geometry.clear();
    element = model = null; input.hidden = true;
    if (document.activeElement === input) {input.blur(); session.wrapper.focus({preventScroll:true});}
  }
  function paint() {
    if (!element) return;
    if (!editable(element) || session.toolState.mode !== 'text-caret') {finish(); return;}
    geometry.draw(element, model, input.selectionStart, input.selectionEnd);
    raf = requestAnimationFrame(paint);
  }
  function select(a,b=a) {
    input.setSelectionRange(Math.min(a,b),Math.max(a,b),b<a?'backward':'forward');
  }
  input.addEventListener("beforeinput", event => {
    if (["insertFromPaste", "deleteByCut", "insertLineBreak"].includes(event.inputType)) commit();
    if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
      event.preventDefault(); finish();
      if (event.inputType === "historyUndo") session.undoSvgHistory(); else session.redoSvgHistory();
    }
  }, {signal});
  function apply() {
    if (!editable(element)) {finish(); return;}
    const diff=textDiff(model.value,input.value);
    if (!diff.inserted && diff.start === diff.end) return;
    if (before === null) before=session.serializeSvgForSave();
    const original = element.innerHTML, previous = model;
    replaceText(element,model,diff.start,diff.end,diff.inserted);
    model=readTextModel(element);
    if (!model) {
      element.innerHTML = original; model = readTextModel(element); input.value = previous.value;
      select(diff.start); session.setStatus("That edit requires an unsupported SVG text layout; use the source editor."); return;
    }
    session.markDocumentDirty(true);
    clearTimeout(timer); timer=setTimeout(commit,800);
  }
  input.addEventListener('input',apply,{signal});
  input.addEventListener('blur',finish,{signal});
  input.addEventListener('keydown',event=>{
    const meta=event.ctrlKey || event.metaKey, key=event.key;
    if (meta && key.toLowerCase() === 's') {commit(); return;}
    event.stopPropagation();
    if (event.isComposing) return;
    if (key === 'Escape') {event.preventDefault(); finish(); return;}
    if (meta && ['z','y'].includes(key.toLowerCase())) {
      event.preventDefault(); finish();
      if (key.toLowerCase()==='y' || event.shiftKey) session.redoSvgHistory(); else session.undoSvgHistory();
      return;
    }
    if (key.startsWith('Arrow') || ['Home','End'].includes(key)) commit();
    // Native input handles word/platform navigation; explicit grapheme boundaries
    // protect emoji sequences and combining marks during basic navigation/deletion.
    if (!meta && !event.altKey && ['ArrowLeft','ArrowRight','Backspace','Delete'].includes(key)) {
      event.preventDefault();
      let a=input.selectionStart,b=input.selectionEnd;
      const backwards=key==='ArrowLeft' || key==='Backspace';
      const focus=input.selectionDirection==='backward'?a:b;
      const previous=model.boundaries.filter(i=>i<focus).at(-1) ?? 0;
      const next=model.boundaries.find(i=>i>focus) ?? model.value.length;
      if (key.startsWith('Arrow')) {
        if (event.shiftKey) select(input.selectionDirection==='backward'?b:a,backwards?previous:next);
        else select(a!==b?(backwards?a:b):(backwards?previous:next));
      } else {
        if (a===b) {a=backwards?previous:a; b=backwards?b:next;}
        input.setRangeText('',a,b,'end'); apply();
      }
    }
  },{signal});
  // Capture before object dragging and drawing handlers see a text gesture.
  const surface=session.svgViewportHost;
  surface.addEventListener('pointerdown',event=>{
    session.syncModeFromToolbarState?.();
    if (session.toolState.mode !== 'text-caret' || event.button !== 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    session.activateSvgEditorContext?.();
    const target=event.target.closest?.('text');
    if (!editable(target)) {finish(); return;}
    if (target !== element) {
      finish(); model=readTextModel(target);
      if (!model) {session.setStatus('This SVG text layout is not supported for direct editing; use the source editor.'); return;}
      element=target; session.clearSelection(); input.value=model.value; input.hidden=false;
      input.style.left=`${event.clientX}px`; input.style.top=`${event.clientY}px`;
      input.focus({preventScroll:true}); raf=requestAnimationFrame(paint);
    } else commit();
    const position=geometry.nearest(element,model,event);
    if (!event.shiftKey) anchor=position;
    else anchor=input.selectionDirection === "backward" ? input.selectionEnd : input.selectionStart;
    select(anchor,position);
    drag=event.pointerId;
    try {surface.setPointerCapture(drag);} catch {}
  },{capture:true,signal});
  surface.addEventListener('pointermove',event=>{
    if (drag !== event.pointerId || !element) return;
    event.preventDefault(); event.stopImmediatePropagation();
    select(anchor,geometry.nearest(element,model,event));
  },{capture:true,signal});
  for (const type of ['pointerup','pointercancel']) surface.addEventListener(type,event=>{
    if (drag !== event.pointerId) return;
    event.stopImmediatePropagation(); release();
  },{capture:true,signal});
  surface.addEventListener('click',event=>{
    if (!element || session.toolState.mode !== 'text-caret') return;
    event.preventDefault(); event.stopImmediatePropagation();
    const position=geometry.nearest(element,model,event);
    if (event.detail === 2) {
      const segments=[...new Intl.Segmenter(undefined,{granularity:'word'}).segment(model.value)];
      const word=segments.find(s=>position>=s.index && position<s.index+s.segment.length) || segments.at(-1);
      if (word) {anchor=word.index; select(anchor,anchor+word.segment.length);}
    } else if (event.detail >= 3) {
      anchor=model.value.lastIndexOf('\n',Math.max(0,position-1))+1;
      const end=model.value.indexOf('\n',position); select(anchor,end<0?model.value.length:end);
    }
  },{capture:true,signal});
  return {finish, commit, dispose(){finish(); abort.abort(); input.remove(); geometry.dispose();}};
}

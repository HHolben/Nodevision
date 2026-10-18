// Nodevision/ApplicationSystem/public/Sessions/BridgingInteractions.mjs
// A Session-owned interaction filter preserves native text navigation while routing history and saves to the existing editor and denying unrelated application commands.
export function installBridgingInteractions({surface,editor,context,onSave,isLocked=()=>false}) {
  const releases=[],view=editor.ownerDocument.defaultView,doc=editor.ownerDocument;
  const add=(target,name,handler,capture=true)=>{target.addEventListener(name,handler,capture);releases.push(()=>target.removeEventListener(name,handler,capture));};
  const block=event=>{event.preventDefault();event.stopImmediatePropagation();};
  const inside=event=>editor.contains(event.target);
  const gate=event=>event.preventDefault();
  add(doc,'nodevision-session-command',event=>{if(event.detail.id==='editor.save'){event.preventDefault();event.detail.result=onSave();}});
  add(doc,'nodevision-session-action',gate);
  add(view,'toolbarAction',block);
  add(view,'keydown',event=>{
    if(event.key==='Escape'){if(event.isComposing){event.stopImmediatePropagation();return;}return block(event);}
    if(!inside(event)) {
      event.stopImmediatePropagation();
      if(!surface.contains(event.target) || event.altKey || ((event.ctrlKey||event.metaKey) && !['c','a'].includes(event.key.toLowerCase())) || /^F\d+$/.test(event.key))event.preventDefault();
      return;
    }
    event.stopImmediatePropagation();
    if(isLocked())return event.preventDefault();
    const key=event.key.toLowerCase(),command=event.ctrlKey||event.metaKey;
    if(command && key==='s'){event.preventDefault();void onSave();return;}
    if(command && ['z','y'].includes(key)){event.preventDefault();editor.__nvProgrammaticHistory?.[key==='y'||event.shiftKey?'redo':'undo']();return;}
    const navigation=['arrowleft','arrowright','arrowup','arrowdown','home','end','pageup','pagedown','backspace','delete'];
    if((command && !['a','c','v','x',...navigation].includes(key)) || (event.altKey && !event.getModifierState?.('AltGraph')) || /^F\d+$/.test(event.key))event.preventDefault();
  });
  add(view,'beforeinput',event=>{
    if(!inside(event))return;
    if(isLocked() || !/^(insertText|insertCompositionText|insertFromComposition|deleteCompositionText|deleteByComposition|insertParagraph|insertLineBreak|insertReplacementText|deleteContentBackward|deleteContentForward|deleteWordBackward|deleteWordForward|deleteSoftLineBackward|deleteSoftLineForward|deleteHardLineBackward|deleteHardLineForward|deleteByCut|historyUndo|historyRedo)$/.test(event.inputType))block(event);
  });
  add(view,'paste',event=>{
    if(!inside(event))return;block(event);if(isLocked())return;
    const text=event.clipboardData?.getData('text/plain');if(text)doc.execCommand('insertText',false,text);
  });
  for(const name of ['copy','cut'])add(view,name,event=>{
    if(!inside(event))return;block(event);if(name==='cut' && isLocked())return;
    const selection=doc.getSelection();if(!selection?.rangeCount || !editor.contains(selection.getRangeAt(0).commonAncestorContainer))return;
    event.clipboardData?.setData('text/plain',selection.toString());
    if(name==='cut' && event.clipboardData)doc.execCommand('delete');
  });
  // Keep native selection and caret placement, but bypass editor object tools.
  for(const name of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick'])add(view,name,event=>{
    if(!inside(event))return;
    event.stopImmediatePropagation();
    if(isLocked() || (name==='click' && event.target.closest?.('a,button,input,select,textarea,video,audio')))event.preventDefault();
  });
  for(const name of ['contextmenu','drop','dragstart'])add(view,name,event=>{if(inside(event))block(event);});
  // Existing programmatic history still wraps native execCommand; deny formatting entry points.
  const original=doc.execCommand;
  const wrapped=function(command,...args){if(!['inserttext','delete','forwarddelete','undo','redo','copy','cut','selectall'].includes(String(command).toLowerCase()))return false;return original.call(this,command,...args);};
  doc.execCommand=wrapped;
  return ()=>{releases.reverse().forEach(release=>release());if(doc.execCommand===wrapped)doc.execCommand=original;};
}

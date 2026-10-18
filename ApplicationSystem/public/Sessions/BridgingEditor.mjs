// Nodevision/ApplicationSystem/public/Sessions/BridgingEditor.mjs
// Bridging borrows a live HTML graphical editor or mounts that same editor, preserving ownership and retaining dirty documents on unexpected Session cleanup.
import {renderEditor} from '../PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs';
export async function mountBridgingEditor(path,host) {
  if(!/\.html?$/i.test(path))throw Error('Choose an HTML document.');
  const previous=window.__nvActiveHtmlEditorContext;
  const normalize=value=>String(value||'').replace(/^\/?Notebook\//,'');
  const borrowed=previous?.editorElement?.isConnected && normalize(previous.filePath)===normalize(path);
  let dispose,marker,wrapper;
  if(borrowed) {
    wrapper=previous.editorElement.closest('#editor-root');
    if(!wrapper)throw Error('The current HTML editor cannot be moved into this Session.');
    previous.editorElement.__nvProgrammaticHistory?.flush();previous.transactions.assertSettled();
    marker=document.createComment('Bridging editor return location');wrapper.before(marker);host.append(wrapper);previous.activate();
  } else {dispose=await renderEditor(path,host);}
  const context=borrowed?previous:host.__nvHtmlEditorContext;
  if(!context){dispose?.();previous?.activate();throw Error('The HTML graphical editor could not load this document.');}
  const editor=context.editorElement;host.inert=true;
  let released=false;
  return {context,editor,
    enable(){host.inert=false;editor.focus();const selection=window.getSelection();if(!editor.contains(selection?.anchorNode)){const range=document.createRange();range.selectNodeContents(editor);range.collapse(true);selection.removeAllRanges();selection.addRange(range);}},
    async save(){editor.__nvProgrammaticHistory?.flush();context.transactions.assertSettled();await context.save();},
    release(){
      if(released)return;released=true;host.inert=false;
      if(borrowed && marker?.isConnected){marker.replaceWith(wrapper);previous.activate();editor.focus();return;}
      if(context.isDirty) {
        const recovery=document.createElement('section');recovery.style.cssText='position:fixed;inset:32px;background:white;color:black;z-index:2000;display:flex;flex-direction:column;padding:12px';
        const label=document.createElement('p');label.textContent='Bridging writing is still open. Save before closing.';
        const save=document.createElement('button');save.textContent='Save and close';
        const warn=event=>{if(context.isDirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);
        save.onclick=async()=>{try{editor.__nvProgrammaticHistory?.flush();await context.save();window.removeEventListener('beforeunload',warn);dispose?.();recovery.remove();previous?.activate();}catch(error){label.textContent='Save failed: '+error.message;}};
        host.style.cssText='flex:1;min-height:0';recovery.append(label,save,host);document.body.append(recovery);context.activate();
      } else {dispose?.();host.remove();previous?.activate();}
    }
  };
}

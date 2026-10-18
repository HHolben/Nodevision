// Nodevision/ApplicationSystem/public/Sessions/BridgingSession.mjs
// This writing Session owns configuration, a borrowed graphical HTML editor, monotonic completion, save recovery and lifecycle cleanup without changing HTML Draft.
import {createBridgingView} from './BridgingView.mjs';
import {mountBridgingEditor} from './BridgingEditor.mjs';
import {createBridgingWordCount} from './BridgingWordCount.mjs';
import {createBridgingProgress,normalizeBridgingGoal} from './BridgingProgress.mjs';
import {installBridgingInteractions} from './BridgingInteractions.mjs';
import {pickNotebook} from '../TemplateSystem/Population/NotebookAssets.mjs';
import createNewFile from '../TemplateSystem/NewDocumentController.mjs';
export async function startBridging(context={}) {
  const root=document.getElementById('nv-session-root');if(!root)throw Error('Bridging must run inside a Session.');
  root.dataset.escapeDisabled='true';const view=createBridgingView(root),abort=new AbortController();
  let adapter,counter,model,interval,releaseInteractions,disposed=false,loading=false,composing=false,pendingSave=false,saveFlight=null;
  const inert=[];
  const done=()=>context.executionContext?.emit?.('session.bridging.finished',{ok:true});
  function error(err){view.message.textContent='Save failed. Your writing is still here. Use Ctrl+S or Retry save. '+err.message;}
  function save(){if(composing){pendingSave=true;return Promise.resolve();}if(saveFlight)return saveFlight;saveFlight=adapter.save().finally(()=>{saveFlight=null;});return saveFlight;}
  const unload=event=>{if(adapter?.context.isDirty){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',unload);
  const cleanup=()=>{
    if(disposed)return;disposed=true;abort.abort();clearInterval(interval);model?.dispose();counter?.dispose();releaseInteractions?.();
    window.removeEventListener('beforeunload',unload);inert.forEach(([node,value])=>{node.inert=value;});
    adapter?.release();delete root.dataset.escapeDisabled;view.surface.remove();
  };
  context.executionContext?.addCleanup?.(cleanup);
  async function load(path){
    if(loading||disposed||!path)return;loading=true;view.start.disabled=true;view.choose.disabled=view.create.disabled=true;
    try {
      counter?.dispose();adapter?.release();adapter=null;
      // release may remove an owned host; restore it before mounting the next editor.
      view.surface.append(view.host);view.host.replaceChildren();
      adapter=await mountBridgingEditor(path,view.host);
      if(disposed){adapter.release();return;}
      counter=createBridgingWordCount(adapter.editor,()=>model?.update());view.path.textContent=path;view.counts(counter.flush());view.start.disabled=false;
      view.message.textContent='Edit text anywhere after beginning. Ctrl+S saves; End Session saves and finishes.';
    }catch(err){view.message.textContent=err.message;}
    finally{loading=false;view.choose.disabled=view.create.disabled=false;}
  }
  view.choose.onclick=async()=>{const path=await pickNotebook(view.surface,{extensions:['html','htm'],signal:abort.signal});await load(path);};
  view.create.onclick=async()=>{const result=await createNewFile();if(result?.path)await load(result.path);};
  view.cancel.onclick=done;
  view.config.oninput=()=>{if(counter)view.counts(counter.flush());};
  view.config.onsubmit=event=>{
    event.preventDefault();if(!adapter||loading||model)return;
    let goal;try{goal=normalizeBridgingGoal(view.goal());}catch(err){view.message.textContent=err.message;return;}
    const initialWordCount=counter.flush();adapter.enable();view.config.hidden=true;view.bar.hidden=false;view.message.textContent='';
    for(const node of document.body.children)if(node!==root){inert.push([node,node.inert]);node.inert=true;}
    const compositionStart=()=>{composing=true;};
    const compositionEnd=()=>{composing=false;setTimeout(()=>{if(disposed)return;if(pendingSave){pendingSave=false;void save().catch(error);}model.update();},0);};
    adapter.editor.addEventListener('compositionstart',compositionStart);
    adapter.editor.addEventListener('compositionend',compositionEnd);
    const releaseEvents=()=>{adapter.editor.removeEventListener('compositionstart',compositionStart);adapter.editor.removeEventListener('compositionend',compositionEnd);};
    const release=installBridgingInteractions({surface:view.surface,editor:adapter.editor,context:adapter.context,onSave:()=>save().catch(error),isLocked:()=>model?.phase!=='writing'});
    releaseInteractions=()=>{releaseEvents();release();};
    model=createBridgingProgress({goal,initialWordCount,readCount:()=>counter.flush(),composing:()=>composing,save:async()=>{if(saveFlight)await saveFlight.catch(()=>{});await save();},
      onUpdate:(stats,phase)=>{view.update(stats,phase);if(phase==='saving')view.host.inert=true;},
      onError:error,onComplete:stats=>{clearInterval(interval);view.summary(stats);const close=view.button('Return to workspace',view.bar);close.onclick=done;}
    });
    view.end.onclick=()=>void model.finish('manual');view.retry.onclick=()=>void model.retry();
    interval=setInterval(()=>model.update(),250);model.update();
  };
  const path=window.__nvActiveHtmlEditorContext?.filePath||window.selectedFilePath;
  if(/\.html?$/i.test(path||''))await load(path);
  return {ok:true};
}

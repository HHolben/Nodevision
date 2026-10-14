// Nodevision/ApplicationSystem/public/Modeling/ModelKeyboard.mjs
// These panel-scoped shortcuts route to modeling actions and protect editable controls. Numeric transforms are previewed as one transaction and Escape restores their exact starting state.
export function installModelKeyboard(host,api,{active,status,frame,save}) {
  let operation=null;
  const typing=target=>target.closest?.('input,textarea,select,[contenteditable],.monaco-editor');
  function finish(cancel=false){if(!operation)return;cancel?api.history.cancel():api.history.commit();operation=null;status(cancel?'Transform cancelled':'Transform complete');}
  function key(event){
    if(!active()||typing(event.target)||event.defaultPrevented)return;
    const k=event.key.toLowerCase();let handled=true;
    try {
      if(operation){
        if(k==='escape')finish(true);else if(k==='enter')finish(false);
        else if(['x','y','z'].includes(k))operation.axis=k;
        else if(k==='backspace')operation.text=operation.text.slice(0,-1);
        else if(/^[0-9.\-]$/.test(k))operation.text+=k;else handled=false;
        if(operation&&handled){const current={...operation};api.history.cancel();api.history.begin('numeric '+current.mode);operation=current;
          if(current.text!==''&&Number.isFinite(Number(current.text))){api.previewTransform({mode:current.mode,axis:current.axis,value:Number(current.text)});}
          status(`${current.mode} ${current.axis.toUpperCase()}: ${current.text||'type a value'} — Enter confirms, Escape cancels`);}
      }else if((event.ctrlKey||event.metaKey)&&k==='z')api.execute(event.shiftKey?'redo':'undo');
      else if((event.ctrlKey||event.metaKey)&&k==='s')save();
      else if(event.altKey&&['g','r','s'].includes(k))api.execute('reset',{mode:{g:'translate',r:'rotate',s:'scale'}[k]});
      else if(event.ctrlKey||event.metaKey||event.altKey)handled=false;
      else if(event.shiftKey&&k==='d')api.execute('duplicate');
      else if(['g','r','s'].includes(k)){operation={mode:{g:'translate',r:'rotate',s:'scale'}[k],axis:k==='s'?'all':'x',text:''};api.history.begin('numeric '+operation.mode);status(`${operation.mode}: X/Y/Z chooses an axis; type a value, Enter confirms`);}
      else if(k==='delete')api.execute('delete');
      else if(k==='f2'){const name=prompt('Object name',api.one().name);if(name!==null)api.execute('rename',{name});}
      else if(k==='home')frame(false);else if(k==='.'||k==='decimal')frame(true);else handled=false;
    }catch(error){if(operation)finish(true);status(error.message);}
    if(handled){event.preventDefault();event.stopImmediatePropagation();}
  }
  host.addEventListener('keydown',key,true);
  return {get active(){return Boolean(operation);},cancel:()=>finish(true),dispose(){finish(true);host.removeEventListener('keydown',key,true);}};
}

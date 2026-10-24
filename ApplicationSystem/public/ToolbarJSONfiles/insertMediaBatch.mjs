// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaBatch.mjs
// Queues selected media in order, serializes loading/insertion, and retains unfinished items for retry.
import {insertHtmlAtCaret} from './insertMediaCommon.mjs';
import {getInsertMediaOriginContext} from './insertMediaPanel.mjs';
export function createMediaBatch(form) {
  const section=document.createElement('section'),list=document.createElement('div'),summary=document.createElement('output');
  section.dataset.mediaBatch='true';section.append(summary,list);form.append(section);
  const status=text=>{const node=form.querySelector('[data-field="status"]');if(node)node.textContent=text;};
  const mode=()=>form.querySelector('input[type=radio][name$="source"]:checked')?.value||'existing';
  const origin=getInsertMediaOriginContext(form),cell=origin?.originCell;
  const html=cell?.__nvHtmlEditorContext||cell?.querySelector?.('[id="editor-root"]')?.parentElement?.__nvHtmlEditorContext||(/html/i.test(origin?.targetMode||window.NodevisionState?.currentMode||'')?window.__nvActiveHtmlEditorContext:null);
  const world=/world/i.test(origin?.targetMode||window.NodevisionState?.currentMode||'')?window.VRWorldContext:null;
  let queue=[],busy=false,loading=Promise.resolve(),cancelled=false,cancelPlacement=null,index=0,total=0,current=null;
  form.addEventListener('click',event=>{if(busy&&event.isTrusted&&event.target!==cancel){event.preventDefault();event.stopImmediatePropagation();}},true);
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Stop after current item';cancel.hidden=true;cancel.onclick=()=>{cancelled=true;cancelPlacement?.();};section.append(cancel);
  function draw(){list.replaceChildren();const items=queue.filter(item=>item.mode===mode());summary.textContent=items.length?`${items.filter(i=>i.selected).length} selected — inserted in order; local files keep their own names.`:'';
    for(const item of items){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=item.selected;check.disabled=busy;check.onchange=()=>{item.selected=check.checked;draw();};label.style.display='block';label.append(check,document.createTextNode(item.name));list.append(label);}
  }
  const setMode=value=>{const radio=form.querySelector(`input[type=radio][name$="source"][value="${value}"]`);if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}};
  form.querySelectorAll('input[type=radio][name$="source"]').forEach(radio=>radio.addEventListener('change',draw));
  function choose(items){queue=items;draw();loading=loading.catch(()=>{}).then(async()=>{if(items[0]){if(await items[0].load()===false)throw Error('Unable to read selected media.');current=items[0];}}).catch(error=>{status(error.message);});}
  const api={
    insertHtml(markup){if(html){if(!html.getEditorElement?.()?.isConnected)throw Error('The originating editor was closed.');html.activate?.();}if(!insertHtmlAtCaret(markup))throw Error('The editor rejected insertion.');return true;},
    addSources(loader){const details=document.createElement('details'),title=document.createElement('summary'),input=document.createElement('textarea'),button=document.createElement('button');title.textContent='Select multiple Notebook paths or URLs';input.rows=4;input.placeholder='One source per line';input.setAttribute('aria-label','Media sources, one per line');button.type='button';button.textContent='Select sources';button.onclick=()=>api.sources(input.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),loader);details.append(title,input,button);section.prepend(details);return loader;},
    get index(){return index;},get total(){return total;},get multiple(){return total>1;},get queued(){return queue.some(item=>item.mode===mode()&&item.selected);},
    bind(input,loader,sourceMode='existing'){
      input.multiple=true;
      input.addEventListener('change',()=>{const files=Array.from(input.files||[]);input.value='';if(!files.length||busy)return;setMode(sourceMode);choose(files.map(file=>({name:file.name,mode:sourceMode,selected:true,load:()=>loader(file)})));});
    },
    sources(paths,loader){if(busy)return;setMode('existing');choose(paths.map(path=>({name:path,mode:'existing',selected:true,load:()=>loader(path)})));},
    async waitForPlacement(placement){if(!placement?.finished)return;cancelPlacement=()=>placement.cancel();try{if(!await placement.finished)throw Error('Placement cancelled. Remaining items are still selected.');}finally{cancelPlacement=null;}},
    onSubmit(insert){form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;busy=true;cancelled=false;cancel.hidden=false;
      const controls=[...form.querySelectorAll('input,select,textarea,button')].filter(node=>node!==cancel).map(node=>[node,node.disabled]);controls.forEach(([node])=>node.disabled=true);
      try{
        await loading;const items=queue.filter(item=>item.mode===mode()&&item.selected);total=items.length||1;
        if(queue.some(item=>item.mode===mode())&&!items.length)throw Error('Select at least one item.');
        const names=items.map(item=>item.name.replace(/[^\w.\-]+/g,'_').toLowerCase());if(new Set(names).size!==names.length)throw Error('Selected files need distinct names to avoid overwriting one another.');
        let completed=0;
        for(index=0;index<total;index++){
          if(cancelled)break;
          if(!form.isConnected)throw Error('The media panel was closed. Remaining items were not inserted.');
          if(world&&window.VRWorldContext!==world)throw Error('The originating world changed. Reopen Insert Media.');
          if(html){if(!html.getEditorElement?.()?.isConnected)throw Error('The originating HTML editor is closed.');html.activate?.();}
          if(items[index]&&(total>1||current!==items[index])){if(await items[index].load()===false)throw Error(`Unable to read ${items[index].name}.`);current=items[index];}
          const result=await insert();if(result===false)break;
          if(items[index])queue=queue.filter(item=>item!==items[index]);completed++;
          status(`Inserted ${completed} of ${total}.`);
        }
        if(cancelled)status('Stopped. Remaining items are still selected.');
      }catch(error){status(error.message);}finally{busy=false;total=0;index=0;cancel.hidden=true;controls.forEach(([node,disabled])=>node.disabled=disabled);draw();}
    });}
  };
  return api;
}

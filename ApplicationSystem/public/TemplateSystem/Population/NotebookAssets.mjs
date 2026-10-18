// Nodevision/ApplicationSystem/public/TemplateSystem/Population/NotebookAssets.mjs
// These small asset controls reuse Notebook listing and binary file APIs without opening or executing selected documents.
export async function readNotebookFile(path,signal) {
  const response=await fetch('/api/file-binary?path='+encodeURIComponent(path),{signal});
  if(!response.ok)throw Error(`Cannot read ${path} (${response.status}).`);
  return new File([await response.blob()],path.split('/').pop());
}
export function pickNotebook(root,{extensions=[],directory=false,signal}={}) {
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog'),title=document.createElement('h2'),list=document.createElement('div'),status=document.createElement('p');
    title.textContent=directory?'Choose output folder':'Choose Notebook file';
    dialog.style.cssText='max-height:80vh;overflow:auto;min-width:320px';dialog.append(title,status,list);
    const finish=value=>{signal?.removeEventListener('abort',abort);dialog.remove();resolve(value);};
    const abort=()=>finish(null);signal?.addEventListener('abort',abort,{once:true});
    const button=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;list.append(b,document.createElement('br'));};
    let revision=0;
    async function show(path) {
      const own=++revision;status.textContent='Notebook/'+path;list.replaceChildren();
      button('Cancel',()=>finish(null));if(directory)button('Use this folder',()=>finish(path));
      if(path)button('↑ Parent folder',()=>show(path.split('/').slice(0,-1).join('/')));
      try {
        const response=await fetch('/api/files?path='+encodeURIComponent(path),{signal});
        if(!response.ok)throw Error('Cannot list this Notebook folder.');
        const entries=await response.json();if(own!==revision || !dialog.isConnected)return;
        for(const entry of entries)if(entry.isDirectory || (!directory && extensions.includes(entry.name.split('.').pop().toLowerCase()))) {
          const target=entry.path || [path,entry.name].filter(Boolean).join('/');
          button((entry.isDirectory?'📁 ':'')+entry.name,()=>entry.isDirectory?show(target):finish(target));
        }
      } catch(error) {if(!signal?.aborted)status.textContent=error.message;}
    }
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    root.append(dialog);dialog.showModal();show('');
  });
}

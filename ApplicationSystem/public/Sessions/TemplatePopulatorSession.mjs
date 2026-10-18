// Nodevision/ApplicationSystem/public/Sessions/TemplatePopulatorSession.mjs
// This Session retains image assignments in browser workspace memory and delegates all document operations to the existing TemplateSystem.
import {discoverPlaceholders,validateAssignments,readAssignment,populateTemplate,savePopulatedDocument} from '../TemplateSystem/Population/TemplatePopulation.mjs';
import {readNotebookFile,pickNotebook} from '../TemplateSystem/Population/NotebookAssets.mjs';
import {getCurrentNotebookDirectory} from '../TemplateSystem/TemplateApi.mjs';
const state={template:null,discovery:null,assignments:new Map(),filename:'',directory:null,message:''};
export async function startTemplatePopulator(context={}) {
  const root=document.getElementById('nv-session-root');
  if(!root)throw Error('Template Populator must run inside a Session.');
  const controller=new AbortController(),{signal}=controller;let busy=false,urls=[];
  const surface=document.createElement('section');surface.style.cssText='height:100%;overflow:auto;box-sizing:border-box;padding:24px;background:var(--panel-bg,#fff);color:var(--text-color,#222)';
  root.replaceChildren(surface);state.directory??=getCurrentNotebookDirectory();
  const cleanUrls=()=>{urls.forEach(url=>URL.revokeObjectURL(url));urls=[];};
  context.executionContext?.addCleanup?.(()=>{controller.abort();cleanUrls();surface.remove();});
  const element=(tag,text,parent=surface)=>{const e=document.createElement(tag);if(text)e.textContent=text;parent.append(e);return e;};
  const button=(text,action,parent=surface)=>{const b=element('button',text,parent);b.type='button';b.disabled=busy;b.onclick=action;b.style.margin='4px';return b;};
  async function perform(action) {
    if(busy || signal.aborted)return;busy=true;state.message='Working…';render();
    try {await action();} catch(error) {if(!signal.aborted)state.message=error.message;}
    finally {busy=false;if(!signal.aborted)render();}
  }
  async function selectTemplate(file,location) {
    if(!file)return;
    await perform(async()=>{
      if(file.size>50*1024*1024)throw Error('Templates must be smaller than 50 MB.');
      const template={name:file.name,location,bytes:new Uint8Array(await file.arrayBuffer())};
      const discovery=await discoverPlaceholders(template);if(signal.aborted)return;
      state.template=template;state.discovery=discovery;state.assignments=new Map(discovery.placeholders.filter(p=>p.type==='text' && !p.defaultConflict).map(p=>[p.name,p.defaultText||'']));
      state.filename=file.name.replace(/\.odp$/i,'')+'-populated.odp';state.message='Template inspected. The original remains unchanged.';
    });
  }
  async function assign(name,file) {
    if(!file)return;await perform(async()=>{const image=await readAssignment(file);if(signal.aborted)return;state.assignments.set(name,image);state.message=`Assigned ${file.name} to ${name}.`;});
  }
  function upload(label,accept,action,parent=surface) {
    const input=element('input',null,parent);input.type='file';input.accept=accept;input.hidden=true;
    input.onchange=()=>action(input.files[0]);button(label,()=>input.click(),parent);
  }
  async function notebook(action,extensions,directory=false) {
    try {
      const path=await pickNotebook(surface,{extensions,directory,signal});if(path===null || signal.aborted)return;
      if(directory){action(path);return;}
      busy=true;render();
      let file;try {file=await readNotebookFile(path,signal);} finally {busy=false;}
      if(!signal.aborted)await action(file,'Notebook/'+path);
    } catch(error) {if(!signal.aborted){state.message=error.message;render();}}
  }
  function render() {
    cleanUrls();surface.replaceChildren();element('h1','Template Populator');
    element('p','Fill named text and image placeholders and save a new presentation. Image fitting: Contain.');
    button('Select Notebook template',()=>notebook(selectTemplate,['odp']));
    upload('Select local template','.odp',file=>selectTemplate(file,'Local file: '+file?.name));
    if(state.template)element('p',`${state.template.name} — ${state.template.location}`);
    if(state.discovery) {
      element('h2',`${state.discovery.placeholders.length} unique placeholders · ${state.discovery.slideCount} slides`);
      for(const placeholder of state.discovery.placeholders) {
        const row=element('fieldset');element('legend',placeholder.name,row);
        element('p',`Slides: ${placeholder.occurrences.map(item=>item.slide).join(', ')} · ${placeholder.occurrences.length} occurrence(s)`,row);
        if(placeholder.type==='text') {
          element('p',placeholder.defaultConflict?'Repeated name has differing defaults. Enter one value for all occurrences.':'Text placeholder',row);
          for(const occurrence of placeholder.occurrences)element('p',`Slide ${occurrence.slide} default: ${occurrence.defaultText||'(empty)'}`,row);
          const label=element('label',placeholder.name+' ',row),input=element('textarea',null,label);
          input.value=state.assignments.get(placeholder.name)||'';input.disabled=busy;
          input.oninput=()=>{state.assignments.set(placeholder.name,input.value);updateGenerate();};
          continue;
        }
        const image=state.assignments.get(placeholder.name);
        if(image) {const preview=element('img',null,row);preview.alt=placeholder.name;preview.src=URL.createObjectURL(image.blob);urls.push(preview.src);preview.style.cssText='width:100px;height:75px;object-fit:contain';}
        element('span',image?` Assigned: ${image.name}`:' Missing image',row);
        upload(image?'Replace with local image':'Select local image','.png,.jpg,.jpeg',file=>assign(placeholder.name,file),row);
        button('Select Notebook image',()=>notebook(file=>assign(placeholder.name,file),['png','jpg','jpeg']),row);
        if(image)button('Clear',()=>{state.assignments.delete(placeholder.name);state.message='Assignment cleared.';render();},row);
      }
    }
    element('h2','Output');
    const label=element('label','Filename '),filename=element('input',null,label);filename.value=state.filename;filename.disabled=busy;
    filename.oninput=()=>{state.filename=filename.value;updateGenerate();};
    const directoryLabel=element('label',' Notebook folder '),directory=element('input',null,directoryLabel);directory.value=state.directory;directory.placeholder='Notebook root';directory.disabled=busy;
    directory.oninput=()=>{state.directory=directory.value;};
    button('Browse folders',()=>notebook(path=>{state.directory=path;render();},[],true));
    const errors=element('ul');errors.setAttribute('aria-live','polite');
    const generate=button('Generate populated copy',()=>perform(async()=>{
      const destination={filename:state.filename.trim(),directory:state.directory};
      const result=await populateTemplate(state.template,state.assignments);if(signal.aborted)return;
      const saved=await savePopulatedDocument(result,destination,{signal});state.message=`Saved ${saved.path}. Open it from File Manager.`;
    }));
    function updateGenerate(){
      const validation=state.discovery?validateAssignments(state.discovery.placeholders,state.assignments,state.discovery.issues):{valid:false,errors:[]};
      errors.replaceChildren();for(const error of validation.errors)element('li',error,errors);
      generate.disabled=busy || !validation.valid || !state.filename.trim();
    }updateGenerate();
    const status=element('p',state.message);status.setAttribute('role','status');status.style.whiteSpace='pre-wrap';
    const finish=button('Finish',()=>context.executionContext?.emit?.('session.templatePopulator.finished',{ok:true}));finish.disabled=false;
  }
  render();return {ok:true};
}

// Representative native-history fixtures and configurable real editor, Layers, Properties and FileView consumers.
import './html-foundation-diagnostics.mjs';
import './html-history-performance-probes.mjs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const originalFetch = window.fetch.bind(window);
window.NodevisionState ||= {};
const files = new Map();
window.fetch = (url, options) => {
  const path = String(url);
  if (path.startsWith('/Notebook/')) return Promise.resolve(new Response(files.get(path.slice(10)) || '<html><body>fixture</body></html>'));
  if (path === '/api/save') return Promise.resolve(Response.json({success:true}));
  if (/recent/i.test(path)) return Promise.resolve(Response.json({entries:[]}));
  return originalFetch(url, options);
};
try {
  const { renderEditor } = await import('/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs');
  const { registerHtmlLiveContent } = await import('/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlLiveContent.mjs');
  const { createHtmlLayersContext } = await import('/PanelInstances/Common/Layers/htmlLayersContext.mjs');
  const { setupPanel: properties } = await import('/PanelInstances/InfoPanels/HTMLPropertiesPanel.mjs');
  const { beginPropertiesEdit } = await import('/PanelInstances/Common/HtmlProperties/PropertiesEdit.mjs');
  const { setupPanel: view, updateViewPanel, setLiveFileViewerEnabled } = await import('/PanelInstances/ViewPanels/FileView.mjs');
  const { subscribe } = await import('/EditorAttentionState.mjs');
  subscribe(() => { perfProbes.count('attentionCommits'); });
  const editor = document.getElementById('editor'), viewer = document.getElementById('viewer'), layers = document.getElementById('layers');
  const props = document.createElement('div'); props.style.cssText='height:220px;overflow:auto';document.body.append(props);
  editor.className='panel-cell active-panel'; viewer.className='panel-cell';
  const retained = document.createElement('div');retained.style.cssText='height:550px;width:650px;display:none';document.body.append(retained);
  let cleanups=[], context, second, refresh;
  function fixture(words, fragmented) {
    const sentence='alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau omega';
    const rows=[];
    for(let i=0;i<words/20;i++) {
      const text=fragmented ? sentence.split(' ').map((w,j)=> j%4===0 ? `<strong>${w}</strong>` : j%4===1 ? `<span style="color:#345">${w}</span>` : j%4===2 ? `<em>${w}</em>` : w).join(' ') : sentence;
      rows.push(`<section id="section-${i}"><p${i===0?' id="text"':''}>${text}</p></section>`);
    }
    return '<!doctype html><html lang="en"><head><title>History performance</title></head><body>'+rows.join('\n')+'</body></html>';
  }
  function caret(owner=context, offset=null) {
    owner.activate(); const root=owner.editorElement, walker=document.createTreeWalker(root.querySelector('#text'),NodeFilter.SHOW_TEXT), n=walker.nextNode();
    const r=document.createRange();r.setStart(n,offset??n.length);r.collapse(true);root.focus();getSelection().removeAllRanges();getSelection().addRange(r);owner.selection.capture();
  }
  function decorate(owner) {
    const original=owner.getHTML.bind(owner);owner.getHTML=()=>perfProbes.time('serialization',original);
    const restore=owner.selection.restore.bind(owner.selection);owner.selection.restore=(...args)=>perfProbes.time('selectionRestore',()=>restore(...args));
    owner.transactions.subscribe(()=>perfProbes.count('revisions'));
    owner.editorElement.__nvProgrammaticHistory.measure();
  }
  async function configure(words, fragmented, config) {
    for(const fn of cleanups.reverse()) fn?.();cleanups=[];refresh?.dispose(); viewer.replaceChildren();editor.replaceChildren();retained.replaceChildren();layers.replaceChildren();props.replaceChildren();
    const source=fixture(words,fragmented); files.set('perf.html',source);files.set('retained.html',source);
    if(window.historyPerfNormalPanels){
      const tabs=await import('/panels/panelTabs.mjs');
      const {setupPanel}=await import('/PanelInstances/EditorPanels/GraphicalEditor.mjs');
      const tab=await tabs.openPanelTabInCell(editor,{panelType:'GraphicalEditor',panelClass:'EditorPanel',resourcePath:'perf.html',panelVars:{filePath:'perf.html'}},setupPanel);
      context=tab.contentElement.querySelector('[data-nv-graphical-editor-root]').__nvHtmlEditorContext;
      cleanups.push(()=>tabs.closePanelTabsInCell(editor));decorate(context);
    }else{
      cleanups.push(await renderEditor('perf.html',editor)); context=editor.__nvHtmlEditorContext;decorate(context);cleanups.push(registerHtmlLiveContent(editor,context));
    }
    second=null;
    if(['retained','session'].includes(config)) { cleanups.push(await renderEditor('retained.html',retained)); second=retained.__nvHtmlEditorContext;decorate(second);cleanups.push(registerHtmlLiveContent(retained,second)); }
    const showView=['fileview','heavy','session'].includes(config), showLayers=['layers','heavy','session'].includes(config), showProps=config==='properties';
    viewer.style.display=showView?'':'none';layers.style.display=showLayers?'':'none';props.style.display=showProps?'':'none';
    if(showLayers) {
      if(window.historyPerfNormalPanels){
        const tabs=await import('/panels/panelTabs.mjs');
        await tabs.openPanelTabInCell(layers,{panelType:'Layers',panelClass:'InfoPanel'},host=>({destroy:createHtmlLayersContext(context.editorElement).attachHost(host)}));
        cleanups.push(()=>tabs.closePanelTabsInCell(layers));
      }else cleanups.push(createHtmlLayersContext(context.editorElement).attachHost(layers));
    }
    if(showProps) { const hooks=properties(props);cleanups.push(()=>hooks?.destroy?.()); }
    setLiveFileViewerEnabled(showView,{refresh:false});
    if(showView) {
      if(window.historyPerfNormalPanels){
        const tabs=await import('/panels/panelTabs.mjs');
        await tabs.openPanelTabInCell(viewer,{panelType:'FileView',panelClass:'ViewPanel',resourcePath:'perf.html',panelVars:{filePath:'perf.html'}},view);
        cleanups.push(()=>tabs.closePanelTabsInCell(viewer));
      }else{const hooks=await view(viewer,{filePath:'perf.html'});cleanups.push(()=>hooks?.destroy?.());}
      await updateViewPanel('perf.html',{force:true});
    }
    refresh=foundationDiagnostics.watchRefreshes(layers,viewer);caret();await delay(750);
    const root=context.editorElement, walker=document.createTreeWalker(root,NodeFilter.SHOW_ALL);let nodes=0;while(walker.nextNode())nodes++;
    return {words,fragmented,config,nodes,elements:root.querySelectorAll('*').length,actualWords:root.textContent.trim().split(/\s+/).length};
  }
  function resetMetrics() { perfProbes.reset();foundationDiagnostics.inputs.length=0;context.editorElement.__nvProgrammaticHistory.measure();refresh.counts.layersMutationBatches=refresh.counts.viewerFramesMounted=refresh.counts.viewerRefreshMutations=0;window.toolbarUpdates=0; }
  window.historyPerf={ready:true,configure,caret,resetMetrics,
    snapshot() {return {samples:foundationDiagnostics.inputs.slice(),probes:perfProbes.snapshot(),journal:structuredClone(context.editorElement.__nvProgrammaticHistory.measurements),history:context.editorElement.__nvProgrammaticHistory.inspect(),refresh:{...refresh.counts},toolbarCalls:window.toolbarUpdates,lifecycle:foundationDiagnostics.counts(),focused:document.activeElement===context.editorElement};},
    async prepare(kind) {
      const root=context.editorElement,p=root.querySelector('#text');
      if(kind==='properties') {const edit=await beginPropertiesEdit(context,p,'color');edit.preview(p.style.color==='red'?'blue':'red');await edit.apply();}
      if(kind==='insertion') context.transactions.run('insert element',()=>{const el=document.createElement('p');el.textContent='inserted';p.after(el);});
      if(kind==='structure') context.transactions.run('insert table',()=>{const t=document.createElement('table');t.innerHTML='<tbody>'+('<tr>'+('<td>cell</td>'.repeat(8))+'</tr>').repeat(12)+'</tbody>';p.after(t);});
      if(kind==='boundary') root.__nvProgrammaticHistory.flush();
    },
    history(direction) {const started=performance.now();context.editorElement.__nvProgrammaticHistory[direction]();return performance.now()-started;},
    previewMatches(){const preview=viewer.querySelector('iframe')?.contentDocument?.querySelector('#text'), authored=context.editorElement.querySelector('#text');return !!preview && preview.textContent === authored.textContent && preview.style.color === authored.style.color;},
    current(){return context;},
    async switchEditor() {if(!second)return;retained.style.display='';editor.style.display='none';caret(second);await delay(10);retained.style.display='none';editor.style.display='';caret(context);},
    source(){return context.getHTML();},
    dispose(){for(const fn of cleanups.reverse())fn?.();cleanups=[];refresh.dispose();editor.replaceChildren();retained.replaceChildren();viewer.replaceChildren();layers.replaceChildren();props.replaceChildren();context=second=null;},
  };
} catch(error) {window.historyPerfError=error.stack;document.getElementById('result').textContent=error.stack;}

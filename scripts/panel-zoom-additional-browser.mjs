// Nodevision/scripts/panel-zoom-additional-browser.mjs
// This fixture checks the shared Ctrl-semantic and exposed-Fn-geometric mapping on PHP source and rendered output, CSV viewing, and SVG viewing, including nested ownership, source invariants, inaccessible frames, and cleanup.
import { checkFramePointerZoom } from './frame-pointer-zoom-browser.mjs';
import { renderFile as viewPhp } from '/PanelInstances/ViewPanels/FileViewers/ViewPHP.mjs';
import { renderFile as viewCsv } from '/PanelInstances/ViewPanels/FileViewers/ViewCSV.mjs';
import { renderFile as viewSvg } from '/PanelInstances/ViewPanels/FileViewers/ViewSVG.mjs';
import { renderEditor as editPhp } from '/PanelInstances/EditorPanels/GraphicalEditors/PHPeditor.mjs';
import { getPanelZoomState, getPanelZoomCapabilities, executePanelZoom } from '/panels/panelZoomCapabilities.mjs';
export async function checkAdditionalZoomPanels({ panel, wheel, tick, ok }) {
  const wait = async predicate => { for (let i=0;i<200;i++) { if(predicate()) return; await new Promise(resolve=>setTimeout(resolve,10)); } throw Error('Additional zoom fixture did not load'); };
  const csv=panel(); window.activeCell=csv;
  await viewCsv('fixture.csv',csv,null,'/Notebook'); const values=csv.textContent;
  wheel(csv,{altKey:false}); ok(getPanelZoomState(csv).zoom===1,'CSV viewer Ctrl semantic does not become scale');
  wheel(csv,{altKey:false,fn:true}); ok(getPanelZoomState(csv).zoom>1 && csv.style.zoom==='' && csv.textContent===values,'CSV viewer Fn scales table only');
  csv._dispose(); ok(!getPanelZoomCapabilities(csv).geometric,'CSV viewer cleanup'); csv.remove();
  const svg=panel(), svgFrame=document.createElement('iframe'); window.activeCell=svg;
  await viewSvg('fixture.svg',svg,svgFrame,'/Notebook'); await wait(()=>svgFrame.contentDocument?.documentElement?.localName==='svg' && getPanelZoomCapabilities(svg).geometric);
  const svgDoc=svgFrame.contentDocument, svgSource=svgDoc.documentElement.outerHTML, svgWidth=svgFrame.contentWindow.innerWidth, shapeWidth=svgDoc.querySelector('rect').getBoundingClientRect().width;
  wheel(svgDoc.documentElement,{altKey:false}); ok(getPanelZoomState(svg).zoom===1,'SVG viewer Ctrl does not scale artwork');
  wheel(svgDoc.documentElement,{altKey:false,fn:true}); ok(getPanelZoomState(svg).zoom>1 && svgDoc.documentElement.outerHTML===svgSource && svgFrame.contentWindow.innerWidth===svgWidth && svgDoc.querySelector('rect').getBoundingClientRect().width===shapeWidth,'SVG viewer Fn bridge preserves source and internal geometry');
  await checkFramePointerZoom({ owner:svg, iframe:svgFrame, wheel, tick, ok });svg._dispose();svg.remove();
  const php=panel(), frame=document.createElement('iframe');window.activeCell=php;
  await viewPhp('fixture.php',php,frame,'/Notebook'); await wait(()=>frame.contentDocument?.querySelector('#php-content') && getPanelZoomCapabilities(php).semantic);
  const doc=frame.contentDocument, source=doc.documentElement.outerHTML;
  wheel(doc.body,{altKey:false,deltaY:100});ok(getPanelZoomState(php,'semantic').zoom<1 && getPanelZoomState(php).zoom===1,'PHP output Ctrl changes semantic density');
  executePanelZoom(php,'semantic',{action:'reset'});wheel(doc.body,{altKey:false,fn:true});
  ok(getPanelZoomState(php).zoom>1 && doc.documentElement.outerHTML===source,'PHP output exposed Fn geometric preserves HTML');
  const crossLoaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
  frame.src=location.origin.replace('127.0.0.1','localhost')+'/Notebook/fixture.php';await crossLoaded;await tick();
  ok(frame.contentDocument===null && !getPanelZoomCapabilities(php).semantic && getPanelZoomCapabilities(php).geometric,'cross-origin PHP exposes only explicit shell geometry');
  executePanelZoom(php,'geometric',{action:'set',zoom:1.4});ok(frame.style.zoom==='1.4','inaccessible PHP shell toolbar zoom');
  php._dispose();php.remove();
  const editorHost=panel();window.activeCell=editorHost;
  const editor=await editPhp('fixture.php',editorHost);editor.state.runtimeEnabled=false;
  const input=editorHost.querySelector('textarea'), highlight=editorHost.querySelector('.nv-php-highlight');
  const preview=editorHost.querySelector('.nv-php-preview'), previewOwner=editorHost.querySelector('.nv-php-preview-wrap');
  await wait(()=>preview.contentDocument?.URL==='about:srcdoc' && preview.contentDocument?.readyState==='complete' && preview.contentDocument?.documentElement && getPanelZoomCapabilities(previewOwner).semantic);await tick();
  input.setSelectionRange(1,4);const code=input.value, selection=[input.selectionStart,input.selectionEnd], initial=getPanelZoomState(editorHost).fontSize;
  const previewDoc=preview.contentDocument, previewSource=previewDoc.documentElement.outerHTML;
  wheel(input,{altKey:false});ok(getPanelZoomState(editorHost).fontSize===initial,'PHP source unsupported semantic is not font size');
  wheel(input,{altKey:false,fn:true});ok(getPanelZoomState(editorHost).fontSize===initial+1 && input.style.fontSize===highlight.style.fontSize,'PHP source Fn scales text and highlight together');
  wheel(previewDoc.body,{altKey:false,fn:true});ok(getPanelZoomState(previewOwner).zoom>1 && getPanelZoomState(editorHost).fontSize===initial+1,'nested PHP preview owns geometric gesture once: '+JSON.stringify({ preview: getPanelZoomState(previewOwner), source:getPanelZoomState(editorHost), active:window.activeCell===editorHost, rects:previewOwner.getClientRects().length }));
  wheel(previewDoc.body,{altKey:false,deltaY:100});ok(getPanelZoomState(previewOwner,'semantic').zoom<1,'PHP preview Ctrl is semantic');
  await checkFramePointerZoom({ owner:previewOwner, iframe:preview, wheel, tick, ok });
  ok(input.value===code && editor.state.code===code && JSON.stringify(selection)===JSON.stringify([input.selectionStart,input.selectionEnd]) && previewDoc.documentElement.outerHTML===previewSource,'PHP zoom preserves source and selection');
  executePanelZoom(editorHost,'geometric',{action:'reset'});ok(getPanelZoomState(editorHost).fontSize===initial,'PHP source resets native font size');
  editor.dispose();ok(!getPanelZoomCapabilities(editorHost).geometric && !getPanelZoomCapabilities(previewOwner).semantic,'PHP editor and preview dispose');editorHost.remove();
}

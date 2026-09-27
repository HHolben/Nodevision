// Nodevision/scripts/svg-layers-browser.mjs
// This browser suite verifies shared SVG layer inspection, real editor reparent history, safe appearance preservation, viewer promotion, and bounded drag feedback work.
import { createElementLayers } from '/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers.mjs';
import { renderFile } from '/PanelInstances/ViewPanels/FileViewers/ViewSVG.mjs';
import { setupPanel } from '/PanelInstances/InfoPanels/SVGLayersPanel.mjs';
import { renderEditor } from '/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs';
import { reparentSvgElement, svgDropRejection } from '/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers/reparent.mjs';
import { getActiveSvgLayersContext, promoteSvgLayerMove } from '/PanelInstances/Common/Layers/svgLayersContext.mjs';
import ViewLayers from '/ToolbarCallbacks/view/ViewLayers.mjs';
const ok=(v,m)=>{if(!v)throw Error(m);};
const equal=(a,b,m)=>ok(a===b,`${m}: ${a} !== ${b}`);
const expectReject=(fn,m)=>{let threw=false;try{fn();}catch{threw=true;}ok(threw,m);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const panel=document.getElementById('layers'), view=document.getElementById('viewer'), edit=document.getElementById('editor');
const rowFor=node=>Array.from(panel.querySelectorAll('[data-nv-layer-drag-row]')).find(row=>row.__nvLayerNode.element===node);
const drag=(type,row,data)=>row.dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:data,clientX:10,clientY:row.getBoundingClientRect().top+10}));
function svg(markup) {
 const root=new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">${markup}</svg>`,'image/svg+xml').documentElement;
 document.body.appendChild(root);return root;
}
try {
 window.NodevisionState={currentMode:'Default',activeFileViewPath:'fixture.svg'};
 let opened=false;const openedHandler=e=>{if(e.detail.id==='SVGLayersPanel')opened=true;};window.addEventListener('toolbarAction',openedHandler);
 ViewLayers();ok(opened,'Layers opens while SVG iframe is loading');window.removeEventListener('toolbarAction',openedHandler);
 const ready=new Promise(resolve=>window.addEventListener('nv-svg-layers-provider-changed',resolve,{once:true}));
 await renderFile('fixture.svg',view);await ready;
 const viewing=getActiveSvgLayersContext(), original=viewing.svgRoot.outerHTML;
 ok(viewing?.readOnly,'viewer exposes read-only provider');await setupPanel(panel);
 const source=viewing.svgRoot.querySelector('#object-a'), target=viewing.svgRoot.querySelector('#layer-b');
 ok(rowFor(source) && rowFor(target),'ordinary groups and objects appear in viewer');
 rowFor(source).click();equal(viewing.svgRoot.outerHTML,original,'inspection never mutates SVG');
 ok(!window.SVGEditorContext,'inspection does not initialize graphical editing');
 // Exercise the normal editor-ready promotion route with the real SVG runtime.
 let cleanupEditor, promotionCount=0;
 const openEditor=async event=>{if(event.detail.id==='GraphicalEditor'){promotionCount++;cleanupEditor=await renderEditor(event.detail.panelVars.filePath,edit);}};
 window.addEventListener('toolbarAction',openEditor);
 await promoteSvgLayerMove(viewing,source,target);await tick();
 const context=window.SVGEditorContext, root=context.svgRoot, moved=root.querySelector('#object-a');
 equal(promotionCount,1,'viewer editing uses GraphicalEditor opening route');
 equal(moved.parentElement.id,'layer-b','viewer drop moves object in editor document');
 equal(viewing.svgRoot.outerHTML,original,'viewer document remains untouched');
 ok(context.isDirty(),'real runtime marks dirty');equal(context.getSelectedElement(),moved,'move selects original editor node');
 context.undo();equal(root.querySelector('#object-a').parentElement.id,'layer-a','real editor undo');
 context.redo();equal(root.querySelector('#object-a').parentElement.id,'layer-b','real editor redo');
 equal(root.querySelector('#object-a'),moved,'move/undo/redo retain node identity');
 let saved='';const fetchOriginal=window.fetch;
 window.fetch=async(url,options)=>{if(url==='/api/save'){saved=JSON.parse(options.body).content;return {ok:true};}return fetchOriginal(url,options);};
 await window.saveWYSIWYGFile('fixture.svg');ok(saved.includes('id="object-a"'),'normal save serializes moved node');ok(!context.isDirty(),'normal save clears dirty');window.fetch=fetchOriginal;
 await setupPanel(panel);ok(!getActiveSvgLayersContext().readOnly,'panel follows promoted editor');
 const a=root.querySelector('#layer-a'), b=root.querySelector('#layer-b');
 const many=document.createElementNS(root.namespaceURI,'g');
 for(let i=0;i<1200;i++){const node=document.createElementNS(root.namespaceURI,'path');node.setAttribute('d',`M ${i} 0 h 1`);many.appendChild(node);}
 a.appendChild(many);await tick();
 const transfer=new DataTransfer();drag('dragstart',rowFor(moved),transfer);
 const scan=Element.prototype.querySelectorAll, box=Element.prototype.getBoundingClientRect;
 const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');let scans=0,rebuilds=0,geometry=0;
 const calls=window.toolbarUpdates;let selectionEvents=0;const selected=()=>selectionEvents++;window.addEventListener('nv-svg-editor-selection-changed',selected);
 Element.prototype.querySelectorAll=function(...args){scans++;return scan.apply(this,args);};
 Element.prototype.getBoundingClientRect=function(...args){geometry++;return box.apply(this,args);};
 Object.defineProperty(Element.prototype,'innerHTML',{...html,set(v){rebuilds++;html.set.call(this,v);}});
 const targetRow=rowFor(a); // Exclude test lookup itself from the scan counter.
 scans=0;
 for(let i=0;i<300;i++) targetRow.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:10}));
 equal(scans,0,'dragover performs no whole-document queries');equal(rebuilds,0,'dragover never rebuilds tree');equal(geometry,0,'object dragover needs no geometry');equal(window.toolbarUpdates,calls,'dragover has no toolbar churn');equal(selectionEvents,0,'dragover has no selection broadcasts');
 equal(targetRow.dataset.dropState,'valid','valid destination highlighted');
 Element.prototype.querySelectorAll=scan;Element.prototype.getBoundingClientRect=box;Object.defineProperty(Element.prototype,'innerHTML',html);
 drag('drop',targetRow,transfer);await tick();equal(moved.parentElement,a,'delegated object drag reaches target rather than bubbling into layer reorder');
 equal(context.getSelectedElement(),moved,'selection survives delegated drop');
 window.removeEventListener('nv-svg-editor-selection-changed',selected);
 context.recordSvgSnapshot('test-fill',()=>{moved.setAttribute('fill','purple');return true;});
 context.undo();context.undo();equal(root.querySelector('#object-a').parentElement.id,'layer-b','reparent undo after runtime snapshot restore');
 context.redo();equal(root.querySelector('#object-a').parentElement.id,'layer-a','reparent redo after runtime snapshot restore');
 context.redo();equal(root.querySelector('#object-a').getAttribute('fill'),'purple','subsequent snapshot redo');
 // Appearance and integrity tests use actual browser SVG geometry and styles.
 const transformed=svg('<g id="from" transform="translate(30 20) rotate(15)" fill="red" stroke="blue"><g id="shape" class="keep" transform="scale(2)" style="stroke-width:3"><title>metadata</title><rect width="10" height="20"/></g></g><g id="to" transform="scale(3)" fill="green"/>');
 const object=transformed.querySelector('#shape'), destination=transformed.querySelector('#to'), authored=object.outerHTML, matrix=object.getScreenCTM();
 const action=reparentSvgElement(transformed,object,destination);equal(object.outerHTML,authored,'all original attributes and nested content survive');ok(destination.contains(object),'compensated object is inside destination');
 const after=object.getScreenCTM();for(const key of ['a','b','c','d','e','f'])ok(Math.abs(after[key]-matrix[key])<1e-5,'canvas transform preserved');
 equal(getComputedStyle(object).fill,'rgb(255, 0, 0)','inherited fill preserved');equal(getComputedStyle(object).stroke,'rgb(0, 0, 255)','inherited stroke preserved');
 action.undo();equal(object.parentElement.id,'from','compensated undo');action.redo();ok(destination.contains(object),'compensated redo');
 // Snapshot operations elsewhere in the SVG editor can replace descendants between history steps.
 const movedSnapshot=transformed.innerHTML; transformed.innerHTML=movedSnapshot;
 action.undo();equal(transformed.querySelector('#shape').parentElement.id,'from','undo after snapshot replacement');
 const restoredSnapshot=transformed.innerHTML;transformed.innerHTML=restoredSnapshot;
 action.redo();ok(transformed.querySelector('#to').contains(transformed.querySelector('#shape')),'redo after snapshot replacement');
 const liveObject=transformed.querySelector('#shape');
 ok(svgDropRejection(transformed,liveObject,liveObject),'self drop rejected');ok(svgDropRejection(transformed,liveObject,liveObject.firstElementChild),'descendant drop rejected');
 ok(svgDropRejection(transformed,liveObject,liveObject.querySelector('rect')),'invalid drawable target rejected');
 const ordered=svg('<g id="source-order"><rect id="first"/><rect id="middle"/><rect id="last"/></g><g id="destination-order"/>');
 const orderAction=reparentSvgElement(ordered,ordered.querySelector('#middle'),ordered.querySelector('#destination-order'));
 ordered.innerHTML=ordered.innerHTML;orderAction.undo();
 equal([...ordered.querySelector('#source-order').children].map(n=>n.id).join(','),'first,middle,last','undo preserves sibling position after snapshot');
 ordered.innerHTML=ordered.innerHTML;orderAction.redo();orderAction.undo();
 equal([...ordered.querySelector('#source-order').children].map(n=>n.id).join(','),'first,middle,last','redo/undo preserves sibling position after another snapshot');
 const unsafe=svg('<g opacity=".5"><rect id="unsafe" width="10" height="10"/></g><g id="plain"/>');
 const unsafeNode=unsafe.querySelector('#unsafe'), unsafeMarkup=unsafe.outerHTML;
 expectReject(()=>reparentSvgElement(unsafe,unsafeNode,unsafe.querySelector('#plain')),'group opacity rejected');equal(unsafe.outerHTML,unsafeMarkup,'invalid move leaves SVG unchanged');
 for(const [attribute,value] of [['filter','url(#effect)'],['clip-path','url(#clip)'],['mask','url(#mask)']]) {
   unsafeNode.parentElement.removeAttribute('opacity');unsafeNode.parentElement.setAttribute(attribute,value);
   expectReject(()=>reparentSvgElement(unsafe,unsafeNode,unsafe.querySelector('#plain')),`${attribute} group rejected`);
   unsafeNode.parentElement.removeAttribute(attribute);
 }
 unsafe.querySelector('#plain').setAttribute('transform','scale(0)');
 expectReject(()=>reparentSvgElement(unsafe,unsafeNode,unsafe.querySelector('#plain')),'singular transform rejected');
 const css=svg('<style>#left rect { fill:red } #right rect {fill:blue}</style><g id="left"><rect id="styled" width="10" height="10"/></g><g id="right"/>');
 const cssBefore=css.outerHTML;expectReject(()=>reparentSvgElement(css,css.querySelector('#styled'),css.querySelector('#right')),'ancestor-dependent CSS rejected');equal(css.outerHTML,cssBefore,'stylesheet rejection rolls back');
 const authoredLayers=svg('<g data-layer="true"><circle r="5"/></g><g data-layer="true"/>');
 const authoredBefore=authoredLayers.outerHTML, inspectionHost=document.createElement('div');document.body.appendChild(inspectionHost);
 const inspection=createElementLayers(authoredLayers,inspectionHost,{readOnly:true});
 equal(authoredLayers.outerHTML,authoredBefore,'viewer inspection never normalizes IDs or layer names');inspection.dispose();
 context.setEditorHTML('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><g data-layer="true" id="authored-a"><rect id="controlled" width="5" height="5"/></g><g data-layer="true" id="authored-b"/></svg>');
 await tick();await setupPanel(panel);
 const controlled=root.querySelector('#controlled'), authoredA=root.querySelector('#authored-a'), authoredB=root.querySelector('#authored-b');
 rowFor(authoredA).children[0].click();await tick();
 rowFor(controlled).children[0].click();await tick();equal(controlled.style.display,'none','existing object visibility control');
 rowFor(controlled).children[0].click();await tick();
 rowFor(controlled).children[1].click();await tick();equal(controlled.getAttribute('data-nv-locked'),'true','existing lock control');
 ok(svgDropRejection(root,controlled,authoredB),'locked object cannot be moved');
 rowFor(controlled).children[1].click();await tick();
 const layerDrag=new DataTransfer();drag('dragstart',rowFor(controlled),layerDrag);drag('drop',rowFor(authoredB),layerDrag);await tick();
 equal(controlled.parentElement,authoredB,'objects drag between authored Nodevision layers');
 const reorder=new DataTransfer();drag('dragstart',rowFor(authoredA).children[2],reorder);drag('drop',rowFor(authoredB),reorder);await tick();
 equal(root.querySelectorAll(':scope > g[data-layer]')[1],authoredA,'existing layer reorder from name button');
 window.NodevisionState={currentMode:'Default',activeFileViewPath:'other.png'};equal(getActiveSvgLayersContext(),null,'non-SVG context does not reuse stale SVG provider');
 window.removeEventListener('toolbarAction',openEditor);panel.__nvCleanupLayersPanel?.();view._dispose();cleanupEditor?.();
 document.getElementById('result').textContent='PASS: SVG viewer/editor Layers, editor promotion, delegated drag, identity, attributes, transform/style preservation, invalid drops, actual runtime undo/redo/save, and 300 dragover events with 1,200 extra objects without scans/rebuilds/geometry/toolbar/selection churn.';
} catch(error) {document.getElementById('result').textContent=`FAIL: ${error.stack}`;}

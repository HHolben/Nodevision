// Coordinate adapters dispatch resource links through each editor's established insertion/history API.
import { registerResourceDropTarget } from './ResourceDropTarget.mjs';
import { resourceReference } from './ResourceTransfer.mjs';
import { linkedResourceMarkup, resourceTag, IMAGE_EXTENSIONS } from '/Media/LinkedResourceMarkup.mjs';
import { markupInsertionAllowed } from '/ToolbarJSONfiles/insertMediaCode.mjs';

function writable(root) {
  if (!root.isConnected || root.closest('[hidden],[aria-hidden="true"],[data-read-only="true"]')) throw Error('The destination is read-only or unavailable.');
}
export function htmlDropRange(root, point) {
  const doc=root.ownerDocument, position=doc.caretPositionFromPoint?.(point.clientX,point.clientY);
  const range=position?doc.createRange():doc.caretRangeFromPoint?.(point.clientX,point.clientY);
  if(position){range.setStart(position.offsetNode,position.offset);range.collapse(true);}
  if(!range||!root.contains(range.startContainer))throw Error('Drop inside editable document content.');
  const parent=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
  if(parent.closest('[contenteditable="false"],script,style,textarea,select,iframe')||['TABLE','THEAD','TBODY','TFOOT','TR','COLGROUP','UL','OL'].includes(parent.tagName))throw Error('Drop inside text, a container, or a table cell.');
  range.collapse(true);return range;
}
export function installHtmlResourceDrops(root,filePath,tools) {
  return registerResourceDropTarget(root,{capture(resource,point){
    writable(root);if(root.contentEditable==='false')throw Error('The document is read-only.');
    const src=resourceReference(filePath,resource.path),range=htmlDropRange(root,point),snapshot=root.innerHTML;
    const parent=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
    if(resourceTag(resource.extension)==='a'&&parent.closest('a'))throw Error('Drop the link outside an existing hyperlink.');
    const validate=()=>{writable(root);if(root.innerHTML!==snapshot||!root.contains(range.startContainer))throw Error('The document changed while loading the resource. Drop it again.');};
    return {label:'Insert linked '+resource.name,rect:range.getBoundingClientRect(),validate,insert(){validate();root.focus();const selection=root.ownerDocument.getSelection();selection.removeAllRanges();selection.addRange(range);
      return tools.insertHTMLAtCaret(linkedResourceMarkup({src,name:resource.name.replace(/\.[^.]+$/,''),extension:resource.extension}));}};
  }});
}
export function svgDropPoint(layer,point) {
  const matrix=layer.getScreenCTM();if(!matrix)throw Error('The SVG layer is not visible.');
  const p=new DOMPoint(point.clientX,point.clientY).matrixTransform(matrix.inverse());
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('The SVG transform is not invertible.');return {x:p.x,y:p.y};
}
export function installSvgResourceDrops(root,filePath,api) {
  return registerResourceDropTarget(root,{capture(resource,point){
    writable(root);if(!IMAGE_EXTENSIONS.has(resource.extension))throw Error('This SVG editor accepts linked images. Use Insert → Media for other options.');
    const layer=api.getActiveLayer?.()||root;
    const validate=()=>{writable(root);if(!root.contains(layer)&&layer!==root)throw Error('The SVG layer changed.');for(let node=layer;node;node=node.parentElement){if(node.getAttribute?.('data-nv-locked')==='true')throw Error('The SVG layer is locked.');if(node===root)break;}};validate();
    const position=svgDropPoint(layer,point),src=resourceReference(filePath,resource.path);
    return {label:'Place linked image here',validate,insert:()=>api.insertImageFromInsertion({src,previewSrc:resource.url,linkedNotebookPath:resource.path,sourceName:resource.name,layerId:layer.id,position,validate})};
  }});
}
// A temporary mirror provides actual textarea coordinates, including wrapping and scroll offsets.
export function textareaDropOffset(input,point) {
  const rect=input.getBoundingClientRect();if(point.clientX<rect.left||point.clientX>rect.right||point.clientY<rect.top||point.clientY>rect.bottom)throw Error('Drop inside the PHP source pane.');
  const mirror=document.createElement('div'),style=getComputedStyle(input);
  for(const key of ['font','fontSize','fontFamily','fontWeight','lineHeight','letterSpacing','tabSize','padding','border','boxSizing','wordBreak'])mirror.style[key]=style[key];
  Object.assign(mirror.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',overflow:'hidden',whiteSpace:input.wrap==='off'?'pre':'pre-wrap',overflowWrap:'break-word',opacity:'0',zIndex:'31000'});
  mirror.textContent=input.value||' ';document.body.append(mirror);mirror.scrollTop=input.scrollTop;mirror.scrollLeft=input.scrollLeft;
  try {const range=document.caretRangeFromPoint?.(point.clientX,point.clientY);if(!range||!mirror.contains(range.startContainer))throw Error('No source insertion position at this point.');return Math.min(input.value.length,range.startOffset);}finally{mirror.remove();}
}
export function installPhpResourceDrops(input,filePath) {
  return registerResourceDropTarget(input,{capture(resource,point){
    writable(input);if(input.readOnly||input.disabled)throw Error('The source is read-only.');
    const source=input.value,offset=textareaDropOffset(input,point),src=resourceReference(filePath,resource.path);
    if(!markupInsertionAllowed(source,offset,'php'))throw Error('Drop in HTML text outside PHP code and tags.');
    const validate=()=>{writable(input);if(input.value!==source||input.readOnly)throw Error('The PHP source changed. Drop the resource again.');};
    return {label:'Insert linked '+resource.name,validate,insert(){validate();input.focus();input.setSelectionRange(offset,offset);const inserted=document.execCommand('insertText',false,linkedResourceMarkup({src,name:resource.name.replace(/\.[^.]+$/,''),extension:resource.extension}));if(inserted)input.dispatchEvent(new Event('input',{bubbles:true}));return inserted;}};
  }});
}
export function installUnsupportedResourceDrops(root) { return registerResourceDropTarget(root,{capture(){throw Error('This editor has no linked-resource representation. Use its existing Insert → Media/import workflow.');}}); }

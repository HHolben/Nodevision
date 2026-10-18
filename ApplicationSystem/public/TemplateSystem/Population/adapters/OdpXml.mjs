// Nodevision/ApplicationSystem/public/TemplateSystem/Population/adapters/OdpXml.mjs
// This module reads detached OpenDocument XML using namespace-aware DOM APIs and identifies image placeholders only where a complete text frame supplies an unambiguous rectangular geometry.
export const NS = Object.freeze({office:'urn:oasis:names:tc:opendocument:xmlns:office:1.0',draw:'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',text:'urn:oasis:names:tc:opendocument:xmlns:text:1.0',svg:'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',manifest:'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',xlink:'http://www.w3.org/1999/xlink',presentation:'urn:oasis:names:tc:opendocument:xmlns:presentation:1.0',style:'urn:oasis:names:tc:opendocument:xmlns:style:1.0',fo:'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0'});
export const elements = (root,ns,name) => Array.from(root.getElementsByTagNameNS(NS[ns],name));
export const is = (node,ns,name) => node?.namespaceURI===NS[ns] && node.localName===name;
export function parseXml(source,name) {
  if (source.length>10*1024*1024 || /<!DOCTYPE|<!ENTITY/i.test(source)) throw Error(`${name}: oversized XML or document type declarations are unsupported.`);
  const doc=new DOMParser().parseFromString(source,'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw Error(`${name}: invalid XML. ${doc.getElementsByTagName('parsererror')[0].textContent}`);
  return doc;
}
export function textValue(node) {
  if (node.nodeType===3) return node.nodeValue;
  if (is(node,'text','s')) return ' '.repeat(Math.min(10000,Math.max(1,Number(node.getAttributeNS(NS.text,'c'))||1)));
  if (is(node,'text','tab')) return '\t';
  if (is(node,'text','line-break')) return '\n';
  return Array.from(node.childNodes).map(textValue).join('');
}
function length(value) {
  const match=String(value).match(/^(-?\d+(?:\.\d+)?)(cm|mm|in|pt|pc)$/);
  if (!match) throw Error('Frame bounds require absolute lengths (cm, mm, in, pt or pc).');
  return Number(match[1])*({cm:1,mm:.1,in:2.54,pt:2.54/72,pc:2.54/6}[match[2]]);
}
function bounds(frame) {
  const result=Object.fromEntries(['x','y','width','height'].map(key=>[key,length(frame.getAttributeNS(NS.svg,key)||(['x','y'].includes(key)?'0cm':''))]));
  if (!(result.width>0 && result.height>0)) throw Error('Frame width and height must be positive.');
  return result;
}
const markers = value => [...value.matchAll(/\{\{([^{}]*)\}\}/g)].map(match=>match[1]);
export function discoverOdpXml(doc) {
  const presentation=elements(doc,'office','presentation')[0];
  if (!presentation || !is(presentation.parentElement,'office','body')) throw Error('The package is not an ODP presentation.');
  const pages=Array.from(presentation.children).filter(node=>is(node,'draw','page'));
  if (!pages.length) throw Error('The presentation contains no slides.');
  const found=new Map(),issues=[],covered=new Set();
  const slideOf=node=>{for(let parent=node;parent;parent=parent.parentElement){const index=pages.indexOf(parent);if(index>=0)return index+1;}return null;};
  for (const box of elements(doc,'draw','text-box')) {
    const paragraphs=[...elements(box,'text','p'),...elements(box,'text','h')];
    const originalText=paragraphs.map(textValue).join('\n'),value=originalText.trim(),names=markers(value);
    const objectName=box.parentElement.getAttributeNS(NS.draw,'name')||'';
    const type=value.includes('{{')?'image':'text';
    if(type==='text' && !objectName)continue;
    paragraphs.forEach(node=>covered.add(node));
    const frame=box.parentElement,slide=slideOf(box);
    try {
      if (type==='text' && !/^[A-Za-z0-9_]+$/.test(objectName))throw Error(`Unrecognized text placeholder name: ${objectName}. Use letters, numbers or underscores.`);
      if (type==='image' && !/^\{\{[A-Za-z0-9_]+\}\}$/.test(value)) throw Error('A placeholder must be the only text in its frame and use letters, numbers or underscores.');
      if (!is(frame,'draw','frame') || !slide || elements(box,'draw','frame').length || elements(box,'text','list').length) throw Error('This placeholder is not in a supported slide text frame.');
      for(let node=frame;node!==pages[slide-1];node=node.parentElement) {
        if (!node || (!is(node,'draw','frame') && !is(node,'draw','g'))) throw Error('Notes, annotations and embedded objects are unsupported placeholder contexts.');
        if (type==='image' && node.hasAttributeNS(NS.draw,'transform')) throw Error('Transformed or rotated placeholder frames are not supported in Phase 1.');
      }
      if (Array.from(frame.children).some(node=>![box.namespaceURI+'|'+box.localName,NS.svg+'|title',NS.svg+'|desc'].includes(node.namespaceURI+'|'+node.localName))) throw Error('The placeholder frame contains other objects.');
      if(type==='text' && Array.from(box.getElementsByTagName('*')).some(node=>!['p','h','span','s','tab','line-break'].some(tag=>is(node,'text',tag))))throw Error('Named text boxes with lists, fields, links or embedded objects are unsupported.');
      const geometry=type==='image'?bounds(frame):undefined,name=type==='image'?names[0]:objectName;
      const placeholder=found.get(name)||{name,type,fit:type==='image'?'contain':undefined,defaultText:type==='text'?originalText:undefined,occurrences:[]};
      if(placeholder.type!==type)throw Error(`Conflicting image and text placeholder types for ${name}. Rename one object.`);
      if(type==='text' && placeholder.defaultText!==originalText)placeholder.defaultConflict=true;
      placeholder.occurrences.push({slide,geometry,frame,box,defaultText:type==='text'?originalText:undefined});found.set(name,placeholder);
    } catch(error) {issues.push({slide,names,message:error.message});}
  }
  for (const node of [...elements(doc,'text','p'),...elements(doc,'text','h')]) {
    if(covered.has(node))continue;
    const value=textValue(node);
    if(value.includes('{{'))issues.push({slide:slideOf(node),names:markers(value),message:'Placeholder outside a supported standalone slide text frame.'});
  }
  for(const object of elements(doc,'draw','*')) {
    const name=object.getAttributeNS(NS.draw,'name');
    if(name && !['frame','g','page'].includes(object.localName) && (elements(object,'text','p').length || elements(object,'text','h').length))issues.push({slide:slideOf(object),names:[name],message:`Named text object ${name} is unsupported; use a text box.`});
  }
  return {placeholders:[...found.values()],issues,slideCount:pages.length};
}
export function containRect(bounds,image) {
  const scale=Math.min(bounds.width/image.width,bounds.height/image.height);
  const width=image.width*scale,height=image.height*scale;
  return {x:bounds.x+(bounds.width-width)/2,y:bounds.y+(bounds.height-height)/2,width,height};
}

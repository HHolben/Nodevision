// Nodevision/ApplicationSystem/public/TemplateSystem/Population/adapters/OdpAdapter.mjs
// This format adapter populates detached OpenDocument presentation packages with embedded images while preserving unrelated XML and resource bytes and maintaining the ODF manifest and mimetype packaging rules.
import '../../../lib/jszip/jszip.min.js';
import {NS,elements,parseXml,discoverOdpXml,containRect} from './OdpXml.mjs';
import {replaceOdpText} from './OdpText.mjs';
export const ODP_MIME='application/vnd.oasis.opendocument.presentation';
const serialize=doc=>new XMLSerializer().serializeToString(doc);
export async function openOdp(bytes) {
  if (bytes.byteLength>50*1024*1024) throw Error('Templates must be smaller than 50 MB.');
  let zip;
  try {zip=await globalThis.JSZip.loadAsync(bytes);} catch {throw Error('Unable to read this ODP ZIP package.');}
  const files=Object.values(zip.files);
  if (files.length>5000 || files.reduce((total,file)=>total+(file._data?.uncompressedSize||0),0)>200*1024*1024) throw Error('The expanded ODP package exceeds the 200 MB / 5,000 entry limit.');
  if (files.some(file=>file.unsafeOriginalName && file.unsafeOriginalName!==file.name)) throw Error('Unsafe ZIP entry paths are unsupported.');
  const read=async name=>{const entry=zip.file(name);if(!entry)throw Error(`ODP is missing ${name}.`);return entry.async('string');};
  if ((await read('mimetype'))!==ODP_MIME) throw Error('The selected file is not an ODP presentation.');
  const content=parseXml(await read('content.xml'),'content.xml'),manifest=parseXml(await read('META-INF/manifest.xml'),'manifest.xml');
  if (manifest.documentElement.namespaceURI!==NS.manifest || manifest.documentElement.localName!=='manifest') throw Error('Invalid OpenDocument manifest.');
  if (elements(manifest,'manifest','encryption-data').length || files.some(file=>/^META-INF\/.*signatures.*\.xml$/i.test(file.name))) throw Error('Encrypted or digitally signed presentations are unsupported.');
  const discovery=discoverOdpXml(content);
  if (zip.file('styles.xml')) {
    const styles=parseXml(await read('styles.xml'),'styles.xml');
    for(const box of elements(styles,'draw','text-box'))if(box.parentElement.getAttributeNS(NS.draw,'name'))discovery.issues.push({slide:null,names:[box.parentElement.getAttributeNS(NS.draw,'name')],message:'Named text placeholder in a master slide is unsupported.'});
    for(const p of [...elements(styles,'text','p'),...elements(styles,'text','h')]) if(p.textContent.includes('{{')) discovery.issues.push({slide:null,names:[],message:'Placeholder in a master slide or style is unsupported.'});
  }
  return {zip,content,manifest,...discovery};
}
export const odpAdapter = {
  extensions:['odp'],mimeType:ODP_MIME,
  async discover(template) {
    const document=await openOdp(template.bytes);
    return {placeholders:document.placeholders.map(({name,type,fit,defaultText,defaultConflict,occurrences})=>({name,type,fit,defaultText,defaultConflict,occurrences:occurrences.map(({slide,geometry,defaultText})=>({slide,geometry,defaultText}))})),issues:document.issues,slideCount:document.slideCount};
  },
  async populate(template,assignments,{fit='contain'}={}) {
    if(fit!=='contain')throw Error('Only Contain fitting is supported.');
    const document=await openOdp(template.bytes);
    if(document.issues.length)throw Error('Resolve unsupported placeholder contexts before generating.');
    const {zip,content,manifest}=document, output=new globalThis.JSZip();
    // ODF requires mimetype first, uncompressed, with no extra field.
    output.file('mimetype',ODP_MIME,{compression:'STORE'});
    for (const file of Object.values(zip.files)) {
      if(file.name==='mimetype')continue;
      output.file(file.name,file.dir?null:await file.async('uint8array'),{dir:file.dir,date:file.date,comment:file.comment,compression:'DEFLATE'});
    }
    let automatic=elements(content,'office','automatic-styles')[0];
    if(!automatic) {automatic=content.createElementNS(NS.office,'office:automatic-styles');content.documentElement.insertBefore(automatic,elements(content,'office','body')[0]);}
    for(const placeholder of document.placeholders) {
      if(placeholder.type==='text') {
        const value=assignments.get(placeholder.name);
        if(typeof value!=='string' || !value.trim())throw Error(`Enter text for ${placeholder.name}.`);
        for(const {box,defaultText} of placeholder.occurrences)if(value!==defaultText)replaceOdpText(box,value);
        continue;
      }
      const image=assignments.get(placeholder.name);
      if(!image?.bytes || !(image.width>0 && image.height>0))throw Error(`Missing or unreadable image: ${placeholder.name}`);
      const id=crypto.randomUUID().replaceAll('-',''),path=`Pictures/nv-${id}.${image.extension}`;
      output.file(path,image.bytes);
      const entry=manifest.createElementNS(NS.manifest,'manifest:file-entry');
      entry.setAttributeNS(NS.manifest,'manifest:full-path',path);entry.setAttributeNS(NS.manifest,'manifest:media-type',image.mimeType);manifest.documentElement.append(entry);
      for(const [index,{frame,box,geometry}] of placeholder.occurrences.entries()) {
        const rect=containRect(geometry,image);
        for(const [key,value] of Object.entries(rect))frame.setAttributeNS(NS.svg,'svg:'+key,Number(value.toFixed(8))+'cm');
        const styleName=`nvImage${id}_${index}`,style=content.createElementNS(NS.style,'style:style');
        style.setAttributeNS(NS.style,'style:name',styleName);style.setAttributeNS(NS.style,'style:family','graphic');
        const parent=frame.getAttributeNS(NS.draw,'style-name');if(parent)style.setAttributeNS(NS.style,'style:parent-style-name',parent);
        const properties=content.createElementNS(NS.style,'style:graphic-properties');
        properties.setAttributeNS(NS.fo,'fo:clip','auto');properties.setAttributeNS(NS.style,'style:mirror','none');
        properties.setAttributeNS(NS.draw,'draw:fill','none');properties.setAttributeNS(NS.draw,'draw:stroke','none');
        style.append(properties);automatic.append(style);frame.setAttributeNS(NS.draw,'draw:style-name',styleName);
        frame.removeAttributeNS(NS.presentation,'style-name');frame.removeAttributeNS(NS.draw,'text-style-name');frame.removeAttributeNS(NS.presentation,'placeholder');
        if(frame.hasAttributeNS(NS.presentation,'class'))frame.setAttributeNS(NS.presentation,'presentation:class','graphic');
        const node=content.createElementNS(NS.draw,'draw:image');
        node.setAttributeNS(NS.xlink,'xlink:href',path);node.setAttributeNS(NS.xlink,'xlink:type','simple');
        node.setAttributeNS(NS.xlink,'xlink:show','embed');node.setAttributeNS(NS.xlink,'xlink:actuate','onLoad');
        frame.replaceChild(node,box);
      }
    }
    output.file('content.xml',serialize(content));output.file('META-INF/manifest.xml',serialize(manifest));
    return {blob:await output.generateAsync({type:'blob',mimeType:ODP_MIME,compression:'DEFLATE'}),extension:'odp',mimeType:ODP_MIME};
  }
};

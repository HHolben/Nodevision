// SVG hrefs remain document-relative in source/history; only live rendering uses served URLs.
export function installSvgLinkedResourcePresentation(root,filePath) {
  const records=new WeakMap(),parts=String(filePath).replace(/^\/?Notebook\//,'').split('/');parts.pop();
  const base=new URL('/Notebook/'+parts.map(encodeURIComponent).join('/')+(parts.length?'/':''),location.href);
  function refresh(){for(const element of root.querySelectorAll('image')){
    let record=records.get(element);if(!record){record=new Map();records.set(element,record);}
    for(const key of ['href','xlink:href']){
      const value=element.getAttribute(key),previous=record.get(key);
      if(value===previous?.resolved)continue;
      if(!value||/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value)){record.delete(key);continue;}
      const resolved=new URL(value,base).href;record.set(key,{source:value,resolved});
      if(key==='xlink:href')element.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',resolved);else element.setAttribute(key,resolved);
    }
  }}
  const observer=new MutationObserver(refresh);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['href','xlink:href']});refresh();
  return {refresh,clean(clone,original=root){const originals=[...(original.matches('image')?[original]:[]),...original.querySelectorAll('image')],copies=[...(clone.matches('image')?[clone]:[]),...clone.querySelectorAll('image')];originals.forEach((element,index)=>{const copy=copies[index];if(!copy)return;for(const [key,value] of records.get(element)||[])if(copy.getAttribute(key)===value.resolved){if(key==='xlink:href')copy.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',value.source);else copy.setAttribute(key,value.source);}});return clone;},dispose(){observer.disconnect();}};
}

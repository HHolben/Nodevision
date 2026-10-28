// Resolve linked HTML media for display while preserving authored document-relative URLs through provenance.
export function installLinkedResourcePresentation(root,filePath) {
  const parts=String(filePath).replace(/^\/?Notebook\//,'').split('/');parts.pop();
  const base=new URL('/Notebook/'+parts.map(encodeURIComponent).join('/')+(parts.length?'/':''),location.href);
  function refresh(){
    const provenance=root.__nvSourceProvenance;if(!provenance)return;
    for(const element of root.querySelectorAll('img,audio,video,source,a[href]')){
      const key=element.localName==='a'?'href':'src',source=provenance.sourceAttribute(element,key);
      if(!source||/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(element.getAttribute(key)||''))continue;
      provenance.resolveAttribute(element,key,new URL(source,base).href);
    }
  }
  const observer=new MutationObserver(refresh);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href']});refresh();
  return ()=>observer.disconnect();
}

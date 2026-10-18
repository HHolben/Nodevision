// Nodevision/ApplicationSystem/public/Sessions/BridgingWordCount.mjs
// Cache independent rendered block counts and invalidate changed blocks, falling back to whole-body rendered text for inline layouts without serializing HTML.
import {countDraftWords} from './HTMLDraftFocusMetrics.mjs';
const independent=new Set(['block','flow-root','list-item','table']);
export function createBridgingWordCount(root,onChange=()=>{}) {
  let count=0,timer=0,disposed=false,dirty=true,rebuild=true,partitioned=false;
  const cache=new Map(),changed=new Set();
  function absorb(records) {
    if(!records.length)return;dirty=true;
    for(const record of records) {
      if(record.type==='attributes'){rebuild=true;cache.clear();continue;}
      if(record.target===root){rebuild=true;continue;}
      let node=record.target.nodeType===1?record.target:record.target.parentElement;
      while(node?.parentElement && node.parentElement!==root)node=node.parentElement;
      if(node?.parentElement===root)changed.add(node);else rebuild=true;
    }
  }
  function blocks() {
    const style=getComputedStyle(root);
    if(!independent.has(style.display))return null;
    const result=[];
    for(const node of root.childNodes) {
      if(node.nodeType===3){if(node.textContent.trim())return null;continue;}
      if(node.nodeType!==1)continue;
      const css=getComputedStyle(node);
      if(css.display==='none'){cache.set(node,0);result.push(node);continue;}
      // Mixed inline layouts need one rendered-text pass to retain word boundaries.
      if(!independent.has(css.display) || css.visibility!=='visible')return null;
      result.push(node);
    }
    return result;
  }
  const flush=()=>{
    if(disposed)return count;absorb(observer.takeRecords());clearTimeout(timer);timer=0;
    if(!dirty)return count;
    const nodes=rebuild?blocks():partitioned?[...root.children]:null;
    partitioned=Boolean(nodes);
    if(!nodes)count=countDraftWords(root.innerText);
    else {
      const current=new Set(nodes);for(const node of cache.keys())if(!current.has(node))cache.delete(node);
      for(const node of nodes)if(!cache.has(node)||changed.has(node))cache.set(node,getComputedStyle(node).display==='none'?0:countDraftWords(node.innerText));
      count=[...cache.values()].reduce((sum,value)=>sum+value,0);
    }
    changed.clear();dirty=false;rebuild=false;return count;
  };
  const schedule=()=>{dirty=true;if(timer||disposed)return;timer=setTimeout(()=>{flush();onChange(count);},160);};
  root.addEventListener('input',schedule);
  const observer=new MutationObserver(records=>{absorb(records);schedule();});
  observer.observe(root,{subtree:true,characterData:true,childList:true,attributes:true,attributeFilter:['hidden','style','class']});
  flush();
  return {flush,get count(){return count;},dispose(){disposed=true;clearTimeout(timer);observer.disconnect();root.removeEventListener('input',schedule);cache.clear();}};
}

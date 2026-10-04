// Opt-in harness-only timing of observer fanout, broad DOM reads, layout reads and notification traffic.
let values={}, counts={}, longTasks=[];
const count=(name,n=1)=>counts[name]=(counts[name]||0)+n;
function time(name,run) {const start=performance.now();try{return run();}finally{(values[name]||=[]).push(performance.now()-start);}}
const nativeObserver=window.MutationObserver;
window.MutationObserver=class extends nativeObserver { constructor(callback){super((...args)=>time('mutationObservers',()=>callback(...args)));} };
for(const [proto,name,label] of [[Element.prototype,'querySelectorAll','qsa'],[Node.prototype,'cloneNode','clone'],[window,'getComputedStyle','computedStyle']]) {
  const original=proto[name];proto[name]=function(...args){count(label);return time(label,()=>original.apply(this,args));};
}
const inner=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
Object.defineProperty(Element.prototype,'innerHTML',{...inner,get(){count('innerHTMLRead');return time('innerHTMLRead',()=>inner.get.call(this));}});
const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,wrapped=new WeakMap();
EventTarget.prototype.addEventListener=function(name,fn,options){
  if((name==='input'||name==='beforeinput') && typeof fn==='function') {
    let entries=wrapped.get(fn);if(!entries)wrapped.set(fn,entries=new Map());
    const original=fn;
    if(!entries.has(name)) entries.set(name,function(...args){return time('all-'+name,()=>original.apply(this,args));});
    fn=entries.get(name);
  }
  return add.call(this,name,fn,options);
};
EventTarget.prototype.removeEventListener=function(name,fn,options){return remove.call(this,name,wrapped.get(fn)?.get(name)||fn,options);};
window.addEventListener('nodevision-live-file-content-changed',()=>count('livePublications'));
window.addEventListener('nodevision-editor-dirty',()=>count('dirtyEvents'));
try{new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask'});}catch{}
window.perfProbes={count,time,reset(){values={};counts={};longTasks=[];},snapshot(){return {values,counts,longTasks};}};

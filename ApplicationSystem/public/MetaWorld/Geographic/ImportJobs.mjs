// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/ImportJobs.mjs
// This controller terminates superseded worker jobs and prevents late results from publishing into a newer crop preview.
export class ImportJobs {
  constructor(factory=()=>new Worker(new URL('./ImportWorker.mjs',import.meta.url),{type:'module'})){this.factory=factory;this.revision=0;this.pending=null;}
  cancel(message='Import cancelled.') {
    this.revision++;const p=this.pending;this.pending=null;if(p){p.worker.terminate();p.reject(Error(message));}
  }
  read(data,progress=()=>{}) {
    if(this.pending)this.cancel('Import superseded.');
    const revision=this.revision;
    return new Promise((resolve,reject)=>{
      const worker=this.factory(),pending={worker,reject};this.pending=pending;
      const finish=(error,value)=>{if(this.pending!==pending||revision!==this.revision)return;this.pending=null;worker.terminate();error?reject(error):resolve(value);};
      worker.onmessage=({data})=>{if(this.pending!==pending||revision!==this.revision)return;if(data.progress)progress(data.progress);else finish(data.error?Object.assign(Error(data.error),{diagnostic:data.diagnostic}):null,data.result);};
      worker.onerror=event=>finish(Error(event.message||'Import worker failed.'));worker.postMessage(data);
    });
  }
}

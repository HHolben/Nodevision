// Nodevision/ApplicationSystem/public/MetaWorld/TerrainDiagnostics/GpuTimer.mjs
// This optional WebGL2 timer polls a bounded queue without waiting for GPU completion. Disjoint, disabled and lost-context intervals discard all outstanding samples so stale or invalid durations cannot appear as valid GPU execution measurements.
export function createGpuTimer(renderer) {
 let gl=null,extension=null,initialized=false,active=null,lastMs=null,samples=0,discarded=0;
 const pending=[];
 function reset(){
  if(active&&gl&&!gl.isContextLost()){gl.endQuery(extension.TIME_ELAPSED_EXT);gl.deleteQuery(active);}active=null;
  for(const query of pending)if(!gl.isContextLost())gl.deleteQuery(query);
  pending.length=0;lastMs=null;
 }
 function begin(enabled){
  if(!enabled){if(active||pending.length||lastMs!==null)reset();return false;}
  if(!initialized){initialized=true;gl=renderer.getContext?.();extension=gl?.createQuery?gl.getExtension('EXT_disjoint_timer_query_webgl2'):null;}
  if(gl?.isContextLost?.()){reset();initialized=false;extension=null;return false;}
  if(!extension)return false;
  if(gl.getParameter(extension.GPU_DISJOINT_EXT)){discarded+=pending.length;reset();return false;}
  while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){
   const query=pending.shift(),value=gl.getQueryParameter(query,gl.QUERY_RESULT);gl.deleteQuery(query);
   if(Number.isFinite(value)&&value>=0){lastMs=value/1e6;samples++;}
  }
  if(active||pending.length>=4||gl.getQuery(extension.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return false;
  active=gl.createQuery();if(!active)return false;gl.beginQuery(extension.TIME_ELAPSED_EXT,active);return true;
 }
 function end(){if(!active)return;if(gl.isContextLost()){reset();initialized=false;extension=null;return;}gl.endQuery(extension.TIME_ELAPSED_EXT);pending.push(active);active=null;}
 return {begin,end,dispose:reset,snapshot:()=>({supported:extension?true:initialized?false:null,elapsedMs:lastMs,samples,pending:pending.length,discarded})};
}

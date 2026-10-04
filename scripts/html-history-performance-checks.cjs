// Enforce notification and collection invariants using the measured real consumers.
module.exports=report=>{
 let checks=0;
 for(const row of report.matrix){
  for(const op of row.operations.filter(op=>/ (undo|redo)$/.test(op.label))){
   const counts=op.probes.counts;
   if(counts.revisions!==1)throw new Error('Expected one replay revision: '+JSON.stringify(row.fixture)+' '+op.label+' '+counts.revisions);
   if((counts.livePublications||0)>1)throw new Error('Duplicate live publication');
   if(op.refresh.viewerFramesMounted>1)throw new Error('Duplicate preview frame');
   if(/^(typing|properties) /.test(op.label)&&op.journal.layersCollect?.length)throw new Error('Local replay recollected Layers');
   if(!op.focused)throw new Error('Preview stole editing focus');
   checks++;
  }
 }
 return checks;
};

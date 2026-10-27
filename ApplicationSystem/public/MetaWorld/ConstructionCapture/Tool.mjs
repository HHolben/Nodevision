// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionCapture/Tool.mjs
// Both toolbar entry workflows and fully specified terminal capture share region sampling and publication services.
import {captureContext,previewCapture,publishCapture} from './Publish.mjs';
import {beginSelection} from './Selection.mjs';
import {openCaptureDialog} from './Dialog.mjs';
export function saveAsConstruction(){const {ctx}=captureContext();if(ctx.captureSelection?.bounds)return openCaptureDialog(ctx.captureSelection.bounds);return beginSelection({complete:region=>openCaptureDialog(region)});}
export async function constructionCaptureCommand([action='select',options={}]){const {ctx}=captureContext();
 if(action==='cancel'){ctx.cancelConstructionCapture?.();ctx.captureCommandAbort?.abort();ctx.captureCommandPreview=null;return true;}
 if(action==='select')return beginSelection();
 if(action==='bounds'){const selection=ctx.captureSelection||beginSelection();selection.setBounds(options.bounds||options);selection.finish();return selection.bounds;}
 if(action==='dialog')return saveAsConstruction();
 if(action==='preview'){ctx.captureCommandAbort?.abort();ctx.captureCommandAbort=new AbortController();ctx.captureCommandPreview=await previewCapture(options.bounds||ctx.captureSelection?.bounds,{signal:ctx.captureCommandAbort.signal});return {occupied:ctx.captureCommandPreview.region.cells.length,temporary:ctx.captureCommandPreview.region.temporary,estimatedBytes:ctx.captureCommandPreview.region.estimatedBytes,limitations:ctx.captureCommandPreview.region.limitations};}
 if(action==='confirm'){if(options.confirm!==true||options.acceptVisualLimitations!==true)throw Error('Explicit confirm:true and acceptVisualLimitations:true are required');if(options.bounds){await constructionCaptureCommand(['preview',options]);}if(!ctx.captureCommandPreview)throw Error('Preview a region first');const result=await publishCapture(ctx.captureCommandPreview,{name:options.name,acceptVisualLimitations:true,signal:ctx.captureCommandAbort.signal});ctx.captureCommandPreview=null;ctx.captureSelection?.cancel();return result;}
 throw Error('Unknown capture action');
}

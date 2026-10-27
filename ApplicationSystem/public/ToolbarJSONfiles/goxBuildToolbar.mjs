// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/goxBuildToolbar.mjs
// Hosts the existing GOX controls in the shared Insert → Block subtoolbar; the document API owns all editing state.
import { controls } from '/Voxels/GoxControls.mjs';
export function initToolbarWidget(host){queueMicrotask(()=>{
  host.__nvGoxControlsDispose?.();
  if(!host.isConnected||!host.closest('#sub-toolbar'))return;
  const api=window.__nvGoxActive;
  if(!api?.element?.isConnected||api.loading||!['GOXediting','GOXviewing'].includes(window.NodevisionState?.currentMode))return;
  controls(api,host);
});}

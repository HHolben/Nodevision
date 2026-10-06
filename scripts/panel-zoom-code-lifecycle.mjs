// Nodevision/scripts/panel-zoom-code-lifecycle.mjs
// This fixture mounts the actual CodeEditor lifecycle after module extraction and verifies independent retained Monaco sessions and adapter disposal.
import { ok, panel, wheel } from './panel-zoom-browser.mjs';
import { getPanelZoomCapabilities } from '/panels/panelZoomCapabilities.mjs';
export async function checkCodeZoomLifecycle() {
  const { setupPanel } = await import('/PanelInstances/EditorPanels/CodeEditor.mjs');
  const workspace=document.createElement('div');workspace.id='workspace';document.body.append(workspace);
  const a=panel(), b=panel(); workspace.append(a,b);
  const waitForEditor=async host=>{for(let i=0;i<100;i++){if(host.__nvCodeEditorSession?.editor)return host.__nvCodeEditorSession;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('CodeEditor session did not mount');};
  const first=await setupPanel(a,{filePath:'first.txt'}), sessionA=await waitForEditor(a);
  window.activeCell=a; wheel(sessionA.editorContainer);
  const size=sessionA.fontSize; ok(size===sessionA.defaultFontSize+1,'actual CodeEditor mount registers native zoom');
  const second=await setupPanel(b,{filePath:'second.txt'}), sessionB=await waitForEditor(b);
  ok(sessionB.fontSize===sessionB.defaultFontSize && sessionA.fontSize===size,'retained CodeEditor sizes are independent');
  wheel(sessionA.editorContainer);ok(sessionA.fontSize===size,'inactive real Monaco owner unchanged');
  first.destroy();second.destroy();ok(!getPanelZoomCapabilities(sessionA.editorContainer).geometric,'CodeEditor destroy unregisters');workspace.remove();
}

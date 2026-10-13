// Nodevision/ApplicationSystem/public/CursorFamilies/RememberedPanelTool.mjs
// This adapter gives editors with legacy shared toolbar settings a panel-owned selected tool. It restores only semantic tool choices on activation and never reacts to hover or pointer presentation.
import { activeToolPanel, registerPanelActiveTool, notifyActiveToolChanged } from './PanelActiveTool.mjs';
export function registerRememberedPanelTool(panel,{currentMode,filePath,key,fallback}) {
  let selected=window.NodevisionState?.[key] || fallback;
  const isActive=()=>{const active=activeToolPanel();return active===panel || active?.contains(panel);};
  const source={currentMode,filePath,getSelectedTool:()=>selected,
    activateTool(value){selected=value;(window.NodevisionState ||= {})[key]=value;notifyActiveToolChanged(panel);}};
  const release=registerPanelActiveTool(panel,source);
  const capture=()=>{if(!isActive())return;const next=window.NodevisionState?.[key] || fallback;if(next!==selected){selected=next;notifyActiveToolChanged(panel);}};
  const restore=()=>{if(!isActive())return;(window.NodevisionState ||= {})[key]=selected;notifyActiveToolChanged(panel);};
  const changes=['nv-contextual-cursor-family-changed','nv-draw-tool-changed'];
  const activations=['activePanelChanged','nv-panel-tab-activated'];
  changes.forEach(type=>window.addEventListener(type,capture));activations.forEach(type=>window.addEventListener(type,restore));
  return ()=>{release();changes.forEach(type=>window.removeEventListener(type,capture));activations.forEach(type=>window.removeEventListener(type,restore));};
}

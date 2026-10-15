// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/worldTextWidget.mjs
// This widget exposes the shared editable world-text insertion commands in the established Insert toolbar.
import { insertWorldText } from '../MetaWorld/Text/TextPlacement.mjs';
export function initToolbarWidget(host) {
  host.replaceChildren();
  for (const [kind,label] of [['free-standing','Free-standing Text'],['surface','Surface Text'],['engraved','Engraved Text (visual)'],['raised','Raised Text'],['sign','Sign']]) {
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.onclick=()=>insertWorldText(kind);host.append(button);
  }
}

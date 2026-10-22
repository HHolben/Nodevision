// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/worldSoundWidget.mjs
// Insert Sound exposes shape placement and editing of the selected shape's sound property.
import {activateSoundTool} from '../MetaWorld/Sounds/SoundTool.mjs';
export function initToolbarWidget(host){
  host.replaceChildren();
  for(const [label,selected] of [['Place sound on shape',false],['Sound on selected shape',true]]){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>activateSoundTool(selected);host.append(button);
  }
}

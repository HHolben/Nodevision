import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
export function appendAnatomy(section,mesh,species){
 const runtime=mesh.userData.mobRuntime,container=document.createElement('section');container.dataset.mobAnatomy='';section.append(container);
 function render(){
  const open=container.querySelector('details')?.open??false,state=runtime.snapshot().anatomy;container.replaceChildren();const title=document.createElement('h4');title.textContent='Anatomy';container.append(title);
  const summary=document.createElement('p');summary.dataset.anatomySummary='';summary.textContent=`${state.state}${state.movement.mobile?'':' (locomotion disabled)'} · Vitality ${Math.round(state.vitality*100)}% · Speed ${Math.round(state.movement.speed*100)}% · Jump ${Math.round(state.movement.jump*100)}% · Acceleration ${Math.round(state.movement.acceleration*100)}% · Turning ${Math.round(state.movement.turning*100)}% · Recovery ×${state.movement.recovery.toFixed(2)} · Perception ${Math.round((state.capabilities.perception??1)*100)}%`;container.append(summary);
  const table=document.createElement('table'),heading=document.createElement('tr');for(const text of ['Part','Condition','Capacity']){const cell=document.createElement('th');cell.textContent=text;heading.append(cell);}table.append(heading);
  const editable=worldAuthoringAllowed(window.VRWorldContext?.movementState);
  for(const part of species.anatomy.parts){const value=state.parts[part.id],row=document.createElement('tr');row.dataset.anatomyPart=part.id;
   for(const text of [part.name,`${Math.round(value.condition/value.maximum*100)}%`,`${Math.round(value.capacity*100)}%`]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}
   if(editable){const cell=document.createElement('td'),input=document.createElement('input');input.type='number';input.min=0;input.max=part.maxCondition;input.step=.05;input.value=value.condition;input.style.width='65px';input.dataset.anatomyCondition=part.id;input.setAttribute('aria-label',part.name+' test condition');input.onchange=()=>{const result=runtime.setPartCondition(part.id,Number(input.value));if(!result.applied)input.setCustomValidity(result.error);else render();};cell.append(input);row.append(cell);}table.append(row);
  }
  container.append(table);
  const sensory=document.createElement('details'),label=document.createElement('summary');sensory.open=open;label.textContent='Sensory capabilities and observations';sensory.append(label);const diagnostics=document.createElement('pre');diagnostics.dataset.sensoryDiagnostics='';diagnostics.style.whiteSpace='pre-wrap';diagnostics.textContent=JSON.stringify(runtime.snapshot().perception,null,2);sensory.append(diagnostics);if(editable){const test=document.createElement('button');test.textContent='Test sound behind hare';test.dataset.testSensorySound='';test.onclick=()=>{runtime.testSound();render();};sensory.append(test);}container.append(sensory);
  const note=document.createElement('p');note.textContent=editable?'Editor test condition: 0 = destroyed, 1 = intact. Close the inspector to observe movement. Injuries last for this session only.':'Injuries last for this session only.';container.append(note);
 }
 render();const panel=window.VRWorldContext?.panel,onDamage=e=>{if(e.detail?.mobId===mesh.userData.id)render();};panel?.addEventListener('mob-damage',onDamage);return ()=>panel?.removeEventListener('mob-damage',onDamage);
}

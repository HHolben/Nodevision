// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/Controls.mjs
// This module binds the existing terrain representation controls to the active authoring bridge and selected terrain. It refreshes after loading, selection, history, and streaming progress, and releases its timer when its host is removed.
import { getActiveMetaWorldLayerBridge, getSelectedMetaWorldObjectId, META_WORLD_LAYER_EVENTS } from '../MetaWorldLayerState.mjs';
import { worldAuthoringAllowed } from '../WorldAuthoringPermissions.mjs';

export function mountTerrainRepresentationControls(host, fixedId = '') {
  host.__terrainControls?.dispose();
  const container = document.createElement('span'), terrain = document.createElement('select');
  const mode = document.createElement('select'), status = document.createElement('output');
  const ground=document.createElement('select'),groundLabel=document.createElement('label');groundLabel.textContent='Polygonal ground style ';groundLabel.append(ground);
  terrain.setAttribute('aria-label', 'Generated terrain'); mode.setAttribute('aria-label', 'Terrain representation');
  ground.setAttribute('aria-label','Polygonal ground style');for(const [value,label] of [['standard','Standard Surface Nets'],['smooth-natural','Smooth natural ground']])ground.add(new Option(label,value));
  status.setAttribute('role', 'status');
  for (const [value, label] of [['voxel', 'Voxel'], ['polygonal', 'Polygonal']]) mode.add(new Option(label, value));
  container.append(terrain, mode, groundLabel, status); host.append(container);
  let busy = false, message = '', selected = fixedId || getSelectedMetaWorldObjectId(), connected = host.isConnected;
  function refresh() {
    const bridge = getActiveMetaWorldLayerBridge(), entries = bridge?.getTerrainRepresentations?.() || [];
    const id = fixedId || selected || terrain.value;
    const signature = JSON.stringify(entries.map(e => [e.id, e.name]));
    if (terrain.dataset.entries !== signature) {
      terrain.replaceChildren(...entries.map(e => new Option(e.name, e.id))); terrain.dataset.entries = signature;
    }
    if (entries.some(e => e.id === id)) terrain.value = id;
    terrain.hidden = Boolean(fixedId);
    const entry = entries.find(e => e.id === terrain.value);
    const allowed = worldAuthoringAllowed(window.VRWorldContext?.movementState);
    mode.disabled = busy || !entry || !allowed; terrain.disabled = busy;
    groundLabel.hidden=entry?.groundStyle===undefined;ground.disabled=busy||!entry||!allowed||entry.pending||entry.representation!=='polygonal';if(!busy)ground.value=entry?.groundStyle||'standard';
    if (!busy) mode.value = entry?.representation || 'voxel';
    status.textContent = entry?.pending ? `Preparing terrain: ${entry.completed}/${entry.total} chunks…`
      : !entry ? 'No generated terrain in this world.'
      : !allowed ? `Viewing ${entry.representation} terrain. Open an editable world to change it.` : message;
  }
  terrain.onchange = () => { selected = terrain.value; message = ''; refresh(); };
  mode.onchange = async () => {
    const bridge = getActiveMetaWorldLayerBridge(), id = terrain.value, value = mode.value;
    busy = true; message = 'Preparing terrain…'; refresh();
    try {
      const changed = await bridge.setTerrainRepresentation(id, value);
      message = changed ? 'Terrain representation updated.' : 'Terrain changed during preparation; try again.';
    } catch (error) { message = error.message; }
    finally { busy = false; refresh(); }
  };
  ground.onchange=async()=>{
    const bridge=getActiveMetaWorldLayerBridge(),id=terrain.value,value=ground.value;busy=true;message='Preparing terrain…';refresh();
    try{const changed=await bridge.setPolygonalGroundStyle(id,value);message=changed?'Polygonal ground style updated.':'Terrain changed during preparation; try again.';}
    catch(error){message=error.message;}finally{busy=false;refresh();}
  };
  const selection = event => { if(event.type===META_WORLD_LAYER_EVENTS.selectionChanged)selected = fixedId || event.detail?.objectId || selected; refresh(); };
  for (const name of Object.values(META_WORLD_LAYER_EVENTS)) window.addEventListener(name, selection);
  const timer = setInterval(() => {
    if (host.isConnected) connected = true;
    if (connected && !host.isConnected) return dispose();
    refresh();
  }, 250);
  function dispose() {
    clearInterval(timer);
    for (const name of Object.values(META_WORLD_LAYER_EVENTS)) window.removeEventListener(name, selection);
    container.remove();
  }
  queueMicrotask(() => { if (!host.isConnected) dispose(); });
  host.__terrainControls = { dispose, refresh }; refresh(); return host.__terrainControls;
}

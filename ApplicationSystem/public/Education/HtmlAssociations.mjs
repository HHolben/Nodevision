// Nodevision/ApplicationSystem/public/Education/HtmlAssociations.mjs
// This module exposes generic world associations for the selected element inside HTML Properties. It reuses semantic identifiers and native navigation while releasing all subscriptions with the owning properties controller.

import { associationSurface } from './AssociationSurface.mjs';
import { associateElement, removeAssociation, selectedRecord } from './AssociationActions.mjs';
import { elementRecords } from './Records.mjs';
import { linkDocument, normalizeDocument } from './WorldLinks.mjs';
import { getActiveMetaWorldLayerBridge, META_WORLD_LAYER_EVENTS } from '../MetaWorld/MetaWorldLayerState.mjs';

export function mountHtmlAssociations(host, getContext, getElement) {
  const ui = associationSurface(host, 'World associations');
  const records = ui.select('Element record'), objects = ui.select('World object');
  let subscribed = null, release = null;
  const api = () => getContext()?.editorElement?.__nvEducation;
  const bridge = () => getActiveMetaWorldLayerBridge();
  function refresh() {
    try {
      const owner = api(), element = getElement();
      ui.section.hidden = !owner || !element || element === owner.root;
      if (owner !== subscribed) {
        release?.(); subscribed = owner; release = owner?.subscribe(refresh);
      }
      const ids = elementRecords(element?.closest('[data-nv-semantic-ids],[data-nv-semantic-id]') || element);
      ui.options(records, ids.map(id => [id, owner?.record(id)?.name || id]), 'Selected HTML element');
      if (!records.value) records.value = selectedRecord(owner, element) || '';
      ui.options(objects, (bridge()?.educationalObjects?.() || []).map(o => [o.id, o.name]));
    } catch (error) { ui.status.textContent = error.message; }
  }
  ui.action('Associate with World Object', () => {
    associateElement(bridge(), objects.value, api(), getElement(), records.value);
    refresh();
  });
  ui.action('Go to Associated World Object', async () => {
    const owner = api(), id = records.value || selectedRecord(owner, getElement()), world = bridge();
    const linked = (world?.educationalObjects?.() || []).filter(o => o.educationalLinks.some(link =>
      link.recordId === id && linkDocument(world.sourcePath, link) === normalizeDocument(owner?.filePath)));
    const target = linked.find(o => o.id === objects.value) || linked[0];
    if (!target || !await world.focusEducationalObject(target.id)) throw Error('Open the associated world first.');
  });
  ui.action('Remove World Association', () => {
    removeAssociation(bridge(), objects.value, api()?.filePath, records.value);
    refresh();
  });
  // Native world events update only these controls, never the main toolbar.
  for (const name of [META_WORLD_LAYER_EVENTS.bridgeChanged, META_WORLD_LAYER_EVENTS.objectsChanged]) {
    ui.listen(window, name, event => {
      if (event.detail?.reason !== 'educationalLinks' && !/transform|Moved/.test(event.detail?.reason || '')) refresh();
    });
  }
  refresh();
  return { refresh, dispose() { release?.(); ui.dispose(); } };
}

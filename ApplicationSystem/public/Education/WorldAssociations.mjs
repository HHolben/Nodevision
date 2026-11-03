// Nodevision/ApplicationSystem/public/Education/WorldAssociations.mjs
// This module embeds document association controls in the existing world-object inspector. It retains unresolved legacy links, supports generic HTML elements, and delegates navigation and undoable edits to existing services.

import { associationSurface } from './AssociationSurface.mjs';
import { associateElement, removeAssociation, selectedRecord } from './AssociationActions.mjs';
import { htmlDocuments } from './HtmlController.mjs';
import { linkDocument } from './WorldLinks.mjs';
import { goToEducationalEntry } from './Navigation.mjs';
import { getActiveMetaWorldLayerBridge, META_WORLD_LAYER_EVENTS } from '../MetaWorld/MetaWorldLayerState.mjs';

export function mountWorldAssociations(host) {
  const ui = associationSurface(host, 'Document associations');
  const documents = ui.select('HTML document'), records = ui.select('Document element');
  const links = ui.select('Existing association');
  let objectId = null, subscribed = null, release = null;
  const bridge = () => getActiveMetaWorldLayerBridge();
  const api = () => htmlDocuments.get(documents.value);
  function refreshRecords() {
    if (ui.section.hidden) return;
    try {
      const owner = api();
      if (owner !== subscribed) { release?.(); subscribed = owner; release = owner?.subscribe(refreshRecords); }
      ui.options(records, (owner?.records() || []).map(r => [r.identifier, r.name || r.identifier]), 'Selected HTML element');
      if (!records.value) records.value = selectedRecord(owner, owner?.selected()) || '';
    } catch (error) { ui.status.textContent = error.message; }
  }
  function refreshLinks() {
    if (ui.section.hidden) return;
    const entries = bridge()?.getEducationalLinks?.(objectId) || [];
    ui.options(links, entries.map((link, i) => [String(i), `${link.recordId} — ${link.document}`]));
    if (!links.value && entries.length) links.value = '0';
  }
  function refresh() {
    if (ui.section.hidden) return;
    ui.options(documents, [...htmlDocuments.values()].map(owner => [owner.filePath, owner.filePath]));
    if (!documents.value) documents.value = [...htmlDocuments.keys()].at(-1) || '';
    refreshRecords(); refreshLinks();
  }
  function chosenLink() {
    const link = links.value !== '' && bridge()?.getEducationalLinks?.(objectId)?.[Number(links.value)];
    if (!link) throw Error('Choose an existing association.');
    return link;
  }
  documents.onchange = refreshRecords;
  ui.action('Link to Document Element', () => {
    const owner = api();
    associateElement(bridge(), objectId, owner, owner?.selected(), records.value);
    refreshLinks();
  });
  ui.action('Go to Document Element', async () => {
    const link = chosenLink(), path = linkDocument(bridge().sourcePath, link);
    if (!path) throw Error('The saved document reference cannot be resolved.');
    await goToEducationalEntry(path, link.recordId);
  });
  ui.action('Remove Document Association', () => {
    const link = chosenLink();
    removeAssociation(bridge(), objectId, linkDocument(bridge().sourcePath, link), link.recordId);
    refreshLinks();
  });
  ui.listen(window, 'nv-educational-documents-changed', refresh);
  ui.listen(window, META_WORLD_LAYER_EVENTS.objectsChanged, event => {
    if (event.detail?.reason === 'educationalLinks') refreshLinks();
  });
  ui.listen(window, META_WORLD_LAYER_EVENTS.bridgeChanged, () => {
    objectId = null; ui.section.hidden = true; release?.(); release = null; subscribed = null;
  });
  ui.section.hidden = true;
  return {
    show(target) {
      while (target && !target.userData?.metaWorldLayerId) target = target.parent;
      objectId = target?.userData?.metaWorldLayerId || null;
      ui.section.hidden = !objectId;
      if (objectId) refresh();
      else { release?.(); release = null; subscribed = null; }
    },
    dispose() { release?.(); ui.dispose(); },
  };
}

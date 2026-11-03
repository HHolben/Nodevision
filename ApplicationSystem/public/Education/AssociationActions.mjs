// Nodevision/ApplicationSystem/public/Education/AssociationActions.mjs
// This module exposes generic document-to-world association operations over the existing persistent semantic records. It preserves relative references and delegates edits to the native document and world history owners.

import { elementRecords } from './Records.mjs';
import { educationalLink, linkDocument, normalizeDocument } from './WorldLinks.mjs';
import { worldAuthoringAllowed } from '../MetaWorld/WorldAuthoringPermissions.mjs';

export function selectedRecord(api, element) {
  return elementRecords(element?.closest('[data-nv-semantic-ids],[data-nv-semantic-id]') || element)
    .find(id => api?.record(id));
}

export function associateElement(bridge, objectId, api, element, recordId) {
  if (!bridge?.setEducationalLinks || !bridge.educationalObjects().some(o => o.id === objectId)) {
    throw Error('Open an editable world and choose an existing object.');
  }
  if (!worldAuthoringAllowed(window.VRWorldContext?.movementState) || window.VRWorldContext?.movementState?.playerMode !== 'creative') throw Error('Switch the world to Build mode before linking.');
  if (!api?.root.isConnected) throw Error('Open the HTML document and select an element.');
  // Validate portability before creating metadata in the document.
  educationalLink(bridge.sourcePath, api.filePath, 'validation');
  let id = recordId || selectedRecord(api, element);
  if (id && !api.record(id)) throw Error('The selected semantic record is missing.');
  if (!id) id = api.create(element, { kind: 'document-element' }).identifier;
  const link = educationalLink(bridge.sourcePath, api.filePath, id);
  const links = bridge.getEducationalLinks(objectId);
  if (!links.some(item => item.recordId === id && linkDocument(bridge.sourcePath, item) === normalizeDocument(api.filePath))) {
    if (bridge.setEducationalLinks(objectId, [...links, link]) === false) throw Error('The world association could not be changed.');
  }
  return id;
}

export function removeAssociation(bridge, objectId, documentPath, recordId) {
  if (!bridge?.setEducationalLinks) throw Error('Open the associated world.');
  if (!worldAuthoringAllowed(window.VRWorldContext?.movementState) || window.VRWorldContext?.movementState?.playerMode !== 'creative') throw Error('Switch the world to Build mode before removing associations.');
  const links = bridge.getEducationalLinks(objectId);
  const next = links.filter(link => link.recordId !== recordId || linkDocument(bridge.sourcePath, link) !== normalizeDocument(documentPath));
  if (next.length === links.length) throw Error('No matching world association exists.');
  if (bridge.setEducationalLinks(objectId, next) === false) throw Error('Switch the world to Build mode before removing associations.');
}

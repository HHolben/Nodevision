// Nodevision/ApplicationSystem/public/panels/savedLayoutModel.test.mjs
// These tests verify structural layout privacy, split and tab preservation, searchable naming, and duplicate protection without storing document sessions.
import assert from 'node:assert/strict';
import { sanitizeWorkspaceLayout, saveNamedLayout, listSavedLayouts } from './savedLayoutModel.mjs';
const source = { type: 'row', direction: 'column', flex: '2 1 0', children: [
  { type: 'cell', panelType: 'FileView', panelClass: 'ViewPanel', filePath: '/home/private/file', activeTabId: 'private.svg', tabs: [
    { tabId: 'private.svg', panelType: 'FileView', panelVars: { filePath: 'private.svg', reference: { path: 'private.svg' }, history: ['secret'], theme: 'dark' }, displayName: 'private.svg' },
    { panelType: 'GraphicalEditor', panelVars: { content: 'UNSAVED', zoom: 2 } }] },
  { type: 'cell', panelType: 'FileManager', flex: '1 1 0' }, { type: 'cell', panelType: 'GraphManager', collapsed: true }] };
const clean = sanitizeWorkspaceLayout(source), text = JSON.stringify(clean);
for (const secret of ['private', 'secret', 'UNSAVED', 'history', 'reference']) assert.ok(!text.includes(secret));
assert.equal(clean.direction, 'column'); assert.equal(clean.flex, '2 1 0');
assert.equal(clean.children[0].tabs[0].panelVars.theme, 'dark');
assert.equal(clean.children[0].tabs[1].panelVars.layoutEmpty, true);
assert.equal(clean.children[2].collapsed, true);
const map = new Map(), storage = { getItem: k => map.get(k), setItem: (k,v) => map.set(k,v) };
saveNamedLayout(storage, 'Writing', source); saveNamedLayout(storage, 'Drawing', source);
assert.equal(listSavedLayouts(storage, 'writ')[0].name, 'Writing');
assert.throws(() => saveNamedLayout(storage, ' writing ', source), /already exists/);
assert.deepEqual(sanitizeWorkspaceLayout(clean), clean);

const { buildPanelTabMetadata, refreshPanelTabMetadata } = await import('./panelTabMetadata.mjs');
globalThis.window = { selectedFilePath: 'private.svg', NodevisionState: { activeFileViewPath: 'private.svg' } };
const tab = { ...buildPanelTabMetadata({ panelType: 'FileView', panelVars: { layoutEmpty: true } }), panelVars: { layoutEmpty: true }, contentElement: { dataset: {} } };
assert.equal(tab.reference, null);
refreshPanelTabMetadata(tab, { dataset: { currentFilePath: 'private.svg' } });
assert.equal(tab.reference, null, 'empty restored tab never inherits a neighboring document');
delete globalThis.window;

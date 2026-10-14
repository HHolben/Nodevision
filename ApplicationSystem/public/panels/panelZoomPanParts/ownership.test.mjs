// Nodevision/ApplicationSystem/public/panels/panelZoomPanParts/ownership.test.mjs
// These regressions distinguish repeated activation of a drawing surface from switching panels or sibling tabs. This keeps workspace click notifications from cancelling multi-click gestures after mouse release.
import test from 'node:test';
import assert from 'node:assert/strict';
import { panelActivationKeepsHost } from './ownership.mjs';

const host = {};
const firstTab = { isConnected: true, contains: target => target === host };
const secondTab = { isConnected: true, contains: () => false };
const cell = {
  isConnected: true, classList: { contains: name => name === 'panel-cell' },
  __nvPanelTabs: { activeTabId: 'first', tabs: [
    { tabId: 'first', contentElement: firstTab }, { tabId: 'second', contentElement: secondTab }
  ] }
};

test('repeated activation of the owning tab preserves its gesture', () => {
  assert.equal(panelActivationKeepsHost({ detail: { cell } }, host), true);
  assert.equal(panelActivationKeepsHost({ detail: { cell, tab: { contentElement: firstTab } } }, host), true);
});
test('a sibling tab in the same cell does not preserve the old gesture', () => {
  assert.equal(panelActivationKeepsHost({ detail: { cell, tab: { contentElement: secondTab } } }, host), false);
  const switched = { ...cell, __nvPanelTabs: { ...cell.__nvPanelTabs, activeTabId: 'second' } };
  assert.equal(panelActivationKeepsHost({ detail: { cell: switched } }, host), false);
});
test('clearing activation and explicit cancellation notifications cancel gestures', () => {
  assert.equal(panelActivationKeepsHost({ detail: { panel: null, cell: null } }, host), false);
  assert.equal(panelActivationKeepsHost({}, host), false);
});

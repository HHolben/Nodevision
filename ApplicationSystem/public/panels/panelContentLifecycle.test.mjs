// Nodevision/ApplicationSystem/public/panels/panelContentLifecycle.test.mjs
// Regression coverage for the preserved panel-content lifecycle contract.

import assert from "node:assert/strict";

if (typeof globalThis.Event !== "function") {
  globalThis.Event = class Event { constructor(type) { this.type = type; } };
}
if (typeof globalThis.CustomEvent !== "function") {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) { super(type); this.detail = init.detail; this.bubbles = Boolean(init.bubbles); }
  };
}

globalThis.window = { NodevisionState: {} };

const {
  activatePanelContentLifecycle,
  deactivatePanelContentLifecycle,
  destroyPanelContentLifecycle,
  getPanelContentLifecycleStats,
  panelContentLifecycleFor,
  registerPanelContentLifecycle,
} = await import("./panelContentLifecycle.mjs");

const events = [];
const host = {
  dispatchEvent(event) { events.push(event); return true; },
};
const calls = { activate: 0, deactivate: 0, destroy: 0 };

const api = registerPanelContentLifecycle(host, {
  activate(detail) { calls.activate += 1; assert.equal(detail.host, host); },
  deactivate() { calls.deactivate += 1; },
  destroy() { calls.destroy += 1; },
}, { tabId: "tab-a", panelType: "FileView" });

assert.equal(panelContentLifecycleFor(host), api);
assert.equal(api.state, "inactive");
assert.equal(activatePanelContentLifecycle(host, { reason: "first" }), true);
assert.equal(activatePanelContentLifecycle(host, { reason: "repeat" }), false, "repeated activation is unchanged");
assert.equal(calls.activate, 1);
assert.equal(api.state, "active");

assert.equal(deactivatePanelContentLifecycle(host, { reason: "hide" }), true);
assert.equal(deactivatePanelContentLifecycle(host, { reason: "repeat" }), false, "repeated deactivation is unchanged");
assert.equal(calls.deactivate, 1);
assert.equal(api.state, "inactive");

assert.equal(activatePanelContentLifecycle(host, { reason: "show-again" }), true);
assert.equal(calls.activate, 2);
assert.equal(destroyPanelContentLifecycle(host, { reason: "close" }), true);
assert.equal(destroyPanelContentLifecycle(host, { reason: "repeat" }), false, "destroy is idempotent");
assert.equal(calls.destroy, 1);
assert.equal(api.state, "destroyed");
assert.deepEqual(api.counts, { activate: 2, deactivate: 1, destroy: 1 });
assert.deepEqual(events.map((event) => event.type), [
  "nv-panel-content-activated",
  "nv-panel-content-deactivated",
  "nv-panel-content-activated",
  "nv-panel-content-destroyed",
]);

const stats = getPanelContentLifecycleStats();
assert.equal(stats.registered, 1);
assert.equal(stats.destroyed, 1);
assert.equal(stats.activateCalls, 2);
assert.equal(stats.deactivateCalls, 1);
assert.equal(stats.destroyCalls, 1);
assert.equal(stats.active, 0);
assert.equal(stats.inactive, 0);

console.log("ok - panel content lifecycle is explicit and idempotent");

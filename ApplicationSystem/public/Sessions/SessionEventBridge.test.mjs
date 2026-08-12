// Nodevision/ApplicationSystem/public/Sessions/SessionEventBridge.test.mjs
// This test validates Session wait payload delivery and listener cleanup without requiring browser panels.

import assert from "node:assert/strict";
import { SessionEventBridge } from "./SessionEventBridge.mjs";

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, handler, options = {}) {
    const list = this.listeners.get(name) || [];
    list.push({ handler, once: Boolean(options.once) });
    this.listeners.set(name, list);
  }
  removeEventListener(name, handler) {
    this.listeners.set(name, (this.listeners.get(name) || []).filter((entry) => entry.handler !== handler));
  }
  dispatch(name, detail) {
    for (const entry of [...(this.listeners.get(name) || [])]) {
      entry.handler({ detail });
      if (entry.once) this.removeEventListener(name, entry.handler);
    }
  }
  count(name) { return (this.listeners.get(name) || []).length; }
}

const target = new FakeTarget();
const bridge = new SessionEventBridge(target);
const waited = bridge.waitFor("overlay.submitted");
assert.equal(bridge.listenerCount(), 1);
target.dispatch("overlay.submitted", { value: "continue", input: "abc" });
assert.deepEqual(await waited, { value: "continue", input: "abc" });
assert.equal(bridge.listenerCount(), 0);
assert.equal(target.count("overlay.submitted"), 0);

const cancelled = bridge.waitFor("session.customEvent");
assert.equal(bridge.listenerCount(), 1);
bridge.clear();
await assert.rejects(cancelled, (err) => err.code === "SESSION_WAIT_CANCELLED");
assert.equal(bridge.listenerCount(), 0);
await assert.rejects(bridge.waitFor("unknown.application.event"), (err) => err.code === "UNKNOWN_EVENT");

console.log("SessionEventBridge tests passed.");

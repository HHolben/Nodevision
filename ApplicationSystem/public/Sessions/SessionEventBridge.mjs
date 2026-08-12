// Nodevision/ApplicationSystem/public/Sessions/SessionEventBridge.mjs
// This module manages temporary event subscriptions used by running Nodevision Sessions and removes them when waits finish or Sessions stop.

import { assertKnownNodevisionEvent, sanitizeEventDetail } from "../Commands/NodevisionEventRegistry.mjs";

export class SessionEventBridge {
  constructor(target = window) {
    this.target = target;
    this.listeners = new Set();
  }

  waitFor(eventName, options = {}) {
    let name = "";
    try {
      name = assertKnownNodevisionEvent(eventName);
    } catch (err) {
      return Promise.reject(err);
    }
    return new Promise((resolve, reject) => {
      let timer = null;
      const record = {};
      const cleanup = () => {
        this.target.removeEventListener(name, handler);
        this.listeners.delete(record);
        if (timer) globalThis.clearTimeout(timer);
      };
      record.cancel = () => {
        cleanup();
        reject(Object.assign(new Error(`Stopped waiting for Session event: ${name}.`), { code: "SESSION_WAIT_CANCELLED" }));
      };
      const handler = (event) => {
        cleanup();
        resolve(sanitizeEventDetail(event?.detail ?? null));
      };
      this.listeners.add(record);
      this.target.addEventListener(name, handler, { once: true });
      if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
        timer = globalThis.setTimeout(() => {
          cleanup();
          reject(new Error(`Timed out waiting for ${name}.`));
        }, options.timeoutMs);
      }
    });
  }

  listenerCount() {
    return this.listeners.size;
  }

  clear() {
    for (const record of [...this.listeners]) record.cancel?.();
    this.listeners.clear();
  }
}

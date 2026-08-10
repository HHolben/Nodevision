// Nodevision/ApplicationSystem/public/Sessions/SessionEventBridge.mjs
// This module manages temporary event subscriptions used by running Nodevision Sessions and removes them when waits finish or Sessions stop.

export class SessionEventBridge {
  constructor(target = window) {
    this.target = target;
    this.listeners = new Set();
  }

  waitFor(eventName, options = {}) {
    const name = String(eventName || "").trim();
    if (!/^[a-zA-Z0-9_.:-]{1,96}$/.test(name)) {
      return Promise.reject(new Error("Invalid Session event name."));
    }
    return new Promise((resolve, reject) => {
      let timer = null;
      const record = {};
      const cleanup = () => {
        this.target.removeEventListener(name, handler);
        this.listeners.delete(record);
        if (timer) window.clearTimeout(timer);
      };
      record.cancel = () => {
        cleanup();
        reject(Object.assign(new Error(`Stopped waiting for Session event.`), { code: "SESSION_WAIT_CANCELLED" }));
      };
      const handler = (event) => {
        cleanup();
        resolve(event?.detail ?? null);
      };
      this.listeners.add(record);
      this.target.addEventListener(name, handler, { once: true });
      if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
        timer = window.setTimeout(() => {
          cleanup();
          reject(new Error(`Timed out waiting for ${name}.`));
        }, options.timeoutMs);
      }
    });
  }

  clear() {
    for (const record of [...this.listeners]) record.cancel?.();
    this.listeners.clear();
  }
}


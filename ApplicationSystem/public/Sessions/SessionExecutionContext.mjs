// Nodevision/ApplicationSystem/public/Sessions/SessionExecutionContext.mjs
// This module provides a running Nodevision Session with temporary state boundaries, command dispatch, and cleaned-up event waits.

import { emitNodevisionEvent } from "../Commands/NodevisionEventRegistry.mjs";
import { runNodevisionCommand } from "./SessionCommandAdapter.mjs";
import { SessionEventBridge } from "./SessionEventBridge.mjs";

export class SessionExecutionContext {
  constructor(options = {}) {
    this.session = options.session || null;
    this.ui = options.ui || null;
    this.eventBridge = options.eventBridge || new SessionEventBridge(window);
    this.commandRunner = options.commandRunner || runNodevisionCommand;
    this.active = true;
    this.cleanups = new Set();
  }

  async run(commandId, args = [], runtime = null) {
    if (!this.active) throw new Error("Session context is no longer active.");
    return this.commandRunner(String(commandId || ""), args, {
      session: this.session,
      ui: this.ui,
      runtime,
      eventBridge: this.eventBridge,
      executionContext: this,
    });
  }

  wait(eventName, options = {}) {
    if (!this.active) return Promise.reject(new Error("Session context is no longer active."));
    return this.eventBridge.waitFor(eventName, options);
  }

  emit(eventName, detail = null) {
    return emitNodevisionEvent(eventName, detail, window);
  }

  addCleanup(callback) {
    if (typeof callback !== "function") return () => {};
    this.cleanups.add(callback);
    return () => this.cleanups.delete(callback);
  }

  cleanup() {
    this.active = false;
    for (const callback of [...this.cleanups]) {
      try { callback(); } catch (err) { console.warn("Session cleanup failed:", err); }
    }
    this.cleanups.clear();
    this.eventBridge.clear();
  }
}


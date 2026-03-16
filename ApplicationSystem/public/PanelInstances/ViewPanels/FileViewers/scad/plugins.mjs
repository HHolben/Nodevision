// Nodevision SCAD Editor - plugins.mjs
// Purpose: Minimal plugin registry (future-facing). Plugins can register primitives/modules/UI components.

/** @typedef {{ type: string, label?: string, defaultParameters?: any, allowChildren?: boolean }} PrimitiveRegistration */
/** @typedef {{ name: string, label?: string, scad?: string }} ModuleRegistration */

/** @type {Map<string, PrimitiveRegistration>} */
const primitives = new Map();
/** @type {Map<string, ModuleRegistration>} */
const modules = new Map();
/** @type {any[]} */
const uiComponents = [];

export function registerPrimitive(type, registration = {}) {
  const key = String(type || "").trim();
  if (!key) throw new Error("registerPrimitive: type required");
  primitives.set(key, { type: key, ...registration });
}

export function registerModule(name, registration = {}) {
  const key = String(name || "").trim();
  if (!key) throw new Error("registerModule: name required");
  modules.set(key, { name: key, ...registration });
}

export function registerUIComponent(component) {
  if (!component) throw new Error("registerUIComponent: component required");
  uiComponents.push(component);
}

export function listPrimitives() {
  return Array.from(primitives.values());
}

export function listModules() {
  return Array.from(modules.values());
}

export function listUIComponents() {
  return [...uiComponents];
}

export function getPrimitiveDefaults(type) {
  return primitives.get(type)?.defaultParameters;
}


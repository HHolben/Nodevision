// Nodevision/ApplicationSystem/public/panels/contextualToolbarRegistry.mjs
// This module maintains one stable contextual toolbar instance per toolbar identity so selection changes can update existing toolbar UI without creating duplicate sub-toolbars.

export function contextualToolbarKey(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.id || value.label || JSON.stringify(value);
}

export function createContextualToolbarRegistry() {
  const entries = new Map();
  return {
    upsert(key, create, update = null) {
      const normalizedKey = contextualToolbarKey(key);
      if (!normalizedKey) return null;
      if (entries.has(normalizedKey)) {
        const existing = entries.get(normalizedKey);
        if (typeof update === "function") update(existing);
        return existing;
      }
      const instance = typeof create === "function" ? create(normalizedKey) : create;
      entries.set(normalizedKey, instance);
      return instance;
    },
    get(key) {
      return entries.get(contextualToolbarKey(key)) || null;
    },
    clear(key = null) {
      if (key == null) {
        entries.clear();
        return;
      }
      entries.delete(contextualToolbarKey(key));
    },
    size() {
      return entries.size;
    },
  };
}

export function ensureSingleContextualToolbarRender(container, key, render, options = {}) {
  if (!container || typeof render !== "function") return null;
  const normalizedKey = contextualToolbarKey(key);
  if (!normalizedKey) return null;
  const currentKey = container.dataset?.nvContextualToolbarKey || "";
  if (currentKey === normalizedKey && !options.force) {
    return container.firstElementChild || null;
  }
  container.textContent = "";
  if (container.dataset) container.dataset.nvContextualToolbarKey = normalizedKey;
  const node = render(container, normalizedKey) || container.firstElementChild;
  dedupeContextualToolbarInstances(container);
  return node;
}

export function clearContextualToolbar(container, key = null) {
  if (!container) return;
  const normalizedKey = contextualToolbarKey(key);
  if (!normalizedKey || container.dataset?.nvContextualToolbarKey === normalizedKey) {
    container.textContent = "";
    if (container.dataset) delete container.dataset.nvContextualToolbarKey;
  }
}

function dedupeContextualToolbarInstances(container) {
  const seen = new Set();
  let anonymousIndex = 0;
  for (const child of [...container.children]) {
    const explicitKey =
      child.getAttribute?.("data-nv-contextual-toolbar-instance") ||
      child.id ||
      child.getAttribute?.("aria-label") ||
      child.title ||
      child.textContent?.trim?.() ||
      "";
    const key = explicitKey || `anonymous-toolbar-item-${anonymousIndex++}`;
    if (seen.has(key)) child.remove();
    else seen.add(key);
  }
}

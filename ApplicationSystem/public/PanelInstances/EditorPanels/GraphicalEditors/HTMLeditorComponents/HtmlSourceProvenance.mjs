// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceProvenance.mjs
// This module distinguishes authored attributes from editor presentation and records reversible resource resolution using private per-document identities that survive body history snapshots but never reach saved source.

const chromeAttribute = 'data-nv-chrome-' + crypto.randomUUID();
export const isHtmlEditorChrome = element => element.hasAttribute(chromeAttribute);
export function markHtmlEditorChrome(element, mode = 'remove') {
  element.setAttribute(chromeAttribute, mode);
  return element;
}

export function createHtmlSourceProvenance(root) {
  const key = 'data-nv-origin-' + crypto.randomUUID();
  const records = new Map();
  let nextId = 0;
  const record = element => records.get(element.getAttribute(key));
  const release = value => { if (value?.startsWith('blob:')) URL.revokeObjectURL(value); };
  function dispose() {
    const resolved = new Set();
    for (const entry of records.values()) for (const resource of entry.resources.values()) resolved.add(resource.resolved);
    resolved.forEach(release);
    records.clear();
  }
  function ensure(element, authored = false) {
    let entry = record(element);
    if (!entry) {
      entry = { authored, attributes: new Map([...element.attributes].map(attr => [attr.name, attr.value])), resources: new Map(), classes: new Map() };
      const id = String(++nextId);
      records.set(id, entry);
      element.setAttribute(key, id);
    }
    return entry;
  }
  // Version the private identity on runtime writes so body undo retains the matching substitutions.
  function fork(element) {
    const previous = ensure(element);
    const entry = { ...previous, resources: new Map(previous.resources), classes: new Map(previous.classes) };
    const id = String(++nextId);
    records.set(id, entry);
    element.setAttribute(key, id);
    return entry;
  }
  function capture(...additionalRoots) {
    dispose();
    for (const container of [root, ...additionalRoots]) {
      // Attribute-free nodes have no authored markers or resources to restore.
      for (const element of container.querySelectorAll('*')) if (element.hasAttributes()) ensure(element, true);
    }
  }
  function clean(clone, transform = null) {
    for (const element of clone.querySelectorAll('*')) {
      if (!element.hasAttributes()) continue;
      const entry = record(element);
      const mode = element.getAttribute(chromeAttribute);
      if (mode && !entry?.authored) {
        if (mode === 'unwrap') element.replaceWith(...element.childNodes);
        else element.remove();
        continue;
      }
      transform?.(element);
      for (const [name, state] of entry?.classes || []) {
        if (element.classList.contains(name) === state.resolved) element.classList.toggle(name, state.authored);
      }
      if (entry?.classes.size && !element.getAttribute('class') && !entry.attributes.has('class')) element.removeAttribute('class');
      for (const [name, resource] of entry?.resources || []) {
        if (element.getAttribute(name) === resource.resolved) {
          if (resource.authored === null) element.removeAttribute(name);
          else element.setAttribute(name, resource.authored);
        }
      }
      if (entry) element.removeAttribute(key);
      if (mode) element.removeAttribute(chromeAttribute);
    }
    return clone;
  }
  return {
    capture, clean,
    isPrivateAttribute: name => name === key || name === chromeAttribute,
    historyAttribute(element, name, value) {
      const entry = record(element), resource = entry?.resources.get(name);
      if (resource && value === resource.resolved) return resource.authored;
      if (name !== 'class' || !entry?.classes.size) return value;
      const classes = new Set((value || '').split(/\s+/).filter(Boolean));
      for (const [token, state] of entry.classes) {
        // Presentation tokens have no authored history, regardless of their current phase.
        if (state.authored) classes.add(token); else classes.delete(token);
      }
      return [...classes].join(' ') || null;
    },
    isAuthored: element => Boolean(record(element)?.authored),
    presentClass(element, name, enabled) {
      const current = element.classList.contains(name);
      if (current === enabled) return;
      const entry = fork(element), previous = entry.classes.get(name);
      entry.classes.set(name, { authored: previous && current === previous.resolved ? previous.authored : current, resolved: enabled });
      element.classList.toggle(name, enabled);
    },
    sourceAttribute(element, name) {
      const resource = record(element)?.resources.get(name);
      return resource && element.getAttribute(name) === resource.resolved ? resource.authored : element.getAttribute(name);
    },
    resolveAttribute(element, name, resolved) {
      const current = element.getAttribute(name);
      if (current === resolved) return;
      const entry = fork(element);
      const previous = entry.resources.get(name);
      const authored = previous && current === previous.resolved ? previous.authored : current;
      entry.resources.set(name, { authored, resolved });
      if (resolved === null) element.removeAttribute(name);
      else element.setAttribute(name, resolved);
    },
    dispose,
  };
}

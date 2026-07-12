// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgUndoStack.mjs
// This module implements a small undo/redo stack for SVG edits. This module records path creation, deletion, and path data changes so Bezier edits can be undone in one logical step instead of per pointer move.

function ensureParentEntry(el) {
  const parent = el?.parentNode;
  return parent ? { parent, next: el.nextSibling } : null;
}

function reinsert(el, info) {
  if (!el || !info?.parent) return;
  try {
    info.parent.insertBefore(el, info.next || null);
  } catch {
    // ignore
  }
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []);
}

export function createSvgUndoStack(limit = 100) {
  const undo = [];
  const redo = [];

  function push(action) {
    undo.push(action);
    if (undo.length > limit) undo.shift();
    redo.length = 0;
  }

  function undoAction() {
    const act = undo.pop();
    if (!act) return null;
    const res = act.undo();
    redo.push(act);
    return res || null;
  }

  function redoAction() {
    const act = redo.pop();
    if (!act) return null;
    const res = act.redo();
    undo.push(act);
    return res || null;
  }

  function pushPathCreate(pathEl) {
    if (!pathEl) return;
    const place = ensureParentEntry(pathEl);
    push({
      kind: "create",
      undo: () => { const p = ensureParentEntry(pathEl); if (pathEl.parentNode) pathEl.remove(); return { removed: true, element: pathEl, place: p }; },
      redo: () => { reinsert(pathEl, place); return { element: pathEl }; },
    });
  }

  function pushElementCreate(elements) {
    const list = asArray(elements);
    if (!list.length) return;
    const places = list.map((el) => ensureParentEntry(el));
    push({
      kind: "create-elements",
      undo: () => {
        const removed = [];
        list.forEach((el) => {
          if (!el?.parentNode) return;
          removed.push(el);
          el.remove();
        });
        return { removed: true, elements: removed, element: removed[0] || null };
      },
      redo: () => {
        list.forEach((el, index) => reinsert(el, places[index]));
        return { elements: list, element: list[0] || null };
      },
    });
  }

  function pushPathRemoval(pathEl) {
    if (!pathEl) return;
    const place = ensureParentEntry(pathEl);
    push({
      kind: "remove",
      undo: () => { reinsert(pathEl, place); return { element: pathEl }; },
      redo: () => { const p = ensureParentEntry(pathEl); if (pathEl.parentNode) pathEl.remove(); return { removed: true, element: pathEl, place: p }; },
    });
  }

  function pushElementRemoval(elements) {
    const list = asArray(elements);
    if (!list.length) return;
    const places = list.map((el) => ensureParentEntry(el));
    push({
      kind: "remove-elements",
      undo: () => {
        list.forEach((el, index) => reinsert(el, places[index]));
        return { elements: list, element: list[0] || null };
      },
      redo: () => {
        const removed = [];
        list.forEach((el) => {
          if (!el?.parentNode) return;
          removed.push(el);
          el.remove();
        });
        return { removed: true, elements: removed, element: removed[0] || null };
      },
    });
  }

  function pushPathChange(pathEl, beforeD, afterD) {
    if (!pathEl) return;
    const b = beforeD ?? "";
    const a = afterD ?? "";
    push({
      kind: "path-d",
      undo: () => { pathEl.setAttribute("d", b); return { element: pathEl }; },
      redo: () => { pathEl.setAttribute("d", a); return { element: pathEl }; },
    });
  }

  function pushCustom(action = {}) {
    if (typeof action.undo !== "function" || typeof action.redo !== "function") return;
    push({
      kind: action.kind || "custom",
      undo: action.undo,
      redo: action.redo,
    });
  }

  return {
    pushPathCreate,
    pushPathRemoval,
    pushPathChange,
    pushElementCreate,
    pushElementRemoval,
    pushCustom,
    undo: undoAction,
    redo: redoAction,
  };
}

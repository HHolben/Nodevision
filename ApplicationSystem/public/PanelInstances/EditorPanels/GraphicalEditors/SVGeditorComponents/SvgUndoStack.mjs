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

  function pushPathRemoval(pathEl) {
    if (!pathEl) return;
    const place = ensureParentEntry(pathEl);
    push({
      kind: "remove",
      undo: () => { reinsert(pathEl, place); return { element: pathEl }; },
      redo: () => { const p = ensureParentEntry(pathEl); if (pathEl.parentNode) pathEl.remove(); return { removed: true, element: pathEl, place: p }; },
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

  return {
    pushPathCreate,
    pushPathRemoval,
    pushPathChange,
    undo: undoAction,
    redo: redoAction,
  };
}

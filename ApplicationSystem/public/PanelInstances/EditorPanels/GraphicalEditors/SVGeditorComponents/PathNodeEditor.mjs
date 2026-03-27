// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PathNodeEditor.mjs
// This module implements Bezier node editing overlays for existing SVG paths. This module renders anchors and handles, hit-tests them, and updates the path model while keeping handle constraints consistent.
import {
  parsePathToModel,
  modelToPathD,
  cloneModel,
  moveNode,
  applyNodeTypeConstraints,
  ensureNodeType,
} from "./BezierModel.mjs";
import { findClosestSegmentPoint, insertNodeAfter, deleteNodeAt, toggleClosed } from "./PathModelOps.mjs";
export function createPathNodeEditor(deps) {
  const {
    svgRoot,
    overlayLayer,
    pointerToleranceInSvgUnits,
    setStatus,
    history,
  } = deps;
  const setAttrs = (el, attrs) => Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  const state = {
    active: false,
    pathEl: null,
    model: null,
    selectedNode: -1,
    drag: null,
  };
  const ui = buildOverlay();

  function buildOverlay() { const g = document.createElementNS(svgRoot.namespaceURI, "g"); setAttrs(g, { "data-nv-editor-ui": "node-overlay" }); g.style.pointerEvents = "none"; overlayLayer.appendChild(g); return { group: g }; }
  function clearUi() { if (!ui.group) return; while (ui.group.firstChild) ui.group.removeChild(ui.group.firstChild); ui.group.style.display = "none"; }
  function renderOverlay() {
    if (!state.active || !state.model) return;
    clearUi(); ui.group.style.display = "";
    state.model.nodes.forEach((node, idx) => {
      if (node.inHandle) { ui.group.appendChild(lineEl(node.inHandle, node)); ui.group.appendChild(handleEl(node.inHandle, idx, "in")); }
      if (node.outHandle) { ui.group.appendChild(lineEl(node, node.outHandle)); ui.group.appendChild(handleEl(node.outHandle, idx, "out")); }
      ui.group.appendChild(anchorEl(node, idx));
    });
  }

  function anchorEl(pt, idx) {
    const c = document.createElementNS(svgRoot.namespaceURI, "circle");
    setAttrs(c, { cx: pt.x, cy: pt.y, r: pointerToleranceInSvgUnits(4), fill: idx === state.selectedNode ? "#2f80ff" : "#ffffff", stroke: "#2f80ff", "stroke-width": "1.2" });
    c.style.pointerEvents = "all"; c.style.cursor = "pointer"; c.addEventListener("pointerdown", (e) => startDrag(e, idx, "anchor")); return c;
  }

  function handleEl(pt, idx, kind) {
    const c = document.createElementNS(svgRoot.namespaceURI, "circle");
    setAttrs(c, { cx: pt.x, cy: pt.y, r: pointerToleranceInSvgUnits(3.5), fill: "#ffffff", stroke: "#7c9cff", "stroke-width": "1" });
    c.style.pointerEvents = "all"; c.style.cursor = "crosshair"; c.addEventListener("pointerdown", (e) => startDrag(e, idx, kind === "in" ? "inHandle" : "outHandle")); return c;
  }

  function lineEl(a, b) { const l = document.createElementNS(svgRoot.namespaceURI, "line"); setAttrs(l, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#7c9cff", "stroke-width": "0.6", "stroke-dasharray": "2 2" }); l.style.pointerEvents = "none"; return l; }

  function startDrag(e, idx, kind) {
    if (!state.active) return;
    state.selectedNode = idx;
    state.drag = { pointerId: e.pointerId, kind, idx, base: cloneModel(state.model), baseD: modelToPathD(state.model) };
    try { svgRoot.setPointerCapture(e.pointerId); } catch {}
    renderOverlay();
    e.stopPropagation();
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!state.drag || state.drag.pointerId !== e.pointerId) return false;
    const pt = svgRoot.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svgRoot.getScreenCTM();
    const r = ctm && ctm.inverse ? pt.matrixTransform(ctm.inverse()) : pt;
    const root = { x: r.x, y: r.y };
    const base = state.drag.base;
    const idx = state.drag.idx;
    const node = base.nodes[idx];
    const active = cloneModel(base);
    const cur = active.nodes[idx];
    const target = root;
    if (state.drag.kind === "anchor") {
      const dx = target.x - node.x;
      const dy = target.y - node.y;
      moveNode(cur, dx, dy);
    } else if (state.drag.kind === "inHandle") {
      cur.inHandle = { x: target.x, y: target.y };
      if (e.altKey) cur.type = "corner";
      applyNodeTypeConstraints(cur, "in");
    } else if (state.drag.kind === "outHandle") {
      cur.outHandle = { x: target.x, y: target.y };
      if (e.altKey) cur.type = "corner";
      applyNodeTypeConstraints(cur, "out");
    }
    state.model = active;
    commit();
    renderOverlay();
    e.preventDefault();
    return true;
  }

  function onPointerUp(e) {
    if (state.drag && state.drag.pointerId === e.pointerId) {
      const beforeD = state.drag.baseD;
      const afterD = modelToPathD(state.model);
      if (beforeD !== afterD) history?.pushPathChange(state.pathEl, beforeD, afterD);
      state.drag = null;
      try { svgRoot.releasePointerCapture(e.pointerId); } catch {}
      return true;
    }
    return false;
  }

  function commit() { if (!state.pathEl || !state.model) return; state.pathEl.setAttribute("d", modelToPathD(state.model)); }

  function enter(pathEl) {
    if (!pathEl || pathEl.tagName.toLowerCase() !== "path") return false;
    state.pathEl = pathEl;
    state.model = parsePathToModel(pathEl);
    state.active = true;
    state.selectedNode = -1;
    renderOverlay();
    setStatus?.("Node edit: drag anchors or handles; 1=corner 2=smooth 3=symmetric");
    return true;
  }

  function exit() { state.active = false; state.pathEl = null; state.model = null; state.selectedNode = -1; state.drag = null; clearUi(); }

  function onSelectionChanged(selection) { if (state.active && !selection.includes(state.pathEl)) exit(); }

  function onPointerDown(e, target, rootPoint) {
    if (!state.active || target !== state.pathEl) return false;
    if (!(e.ctrlKey || e.metaKey)) return false;
    const hit = findClosestSegmentPoint(state.model, rootPoint);
    const tol = pointerToleranceInSvgUnits(8);
    if (!hit || hit.dist > tol) return false;
    const beforeD = modelToPathD(state.model);
    state.model = insertNodeAfter(state.model, hit.index, hit.point);
    commit(); renderOverlay();
    history?.pushPathChange(state.pathEl, beforeD, modelToPathD(state.model));
    e.preventDefault(); e.stopPropagation();
    return true;
  }

  function onKeyDown(e) {
    if (!state.active) return false;
    const key = String(e.key || "");
    if (key === "Escape") {
      exit();
      e.preventDefault();
      return true;
    }
    if (key === "Delete" || key === "Backspace") {
      if (state.selectedNode >= 0) {
        const beforeD = modelToPathD(state.model);
        state.model = deleteNodeAt(state.model, state.selectedNode);
        state.selectedNode = Math.min(state.selectedNode, state.model.nodes.length - 1);
        commit(); renderOverlay();
        history?.pushPathChange(state.pathEl, beforeD, modelToPathD(state.model));
        return true;
      }
    }
    if (key.toLowerCase() === "z") {
      const beforeD = modelToPathD(state.model);
      state.model = toggleClosed(state.model);
      commit(); renderOverlay();
      history?.pushPathChange(state.pathEl, beforeD, modelToPathD(state.model));
      return true;
    }
    if (state.selectedNode >= 0) {
      const node = state.model.nodes[state.selectedNode];
      const beforeD = modelToPathD(state.model);
      if (key === "1") ensureNodeType(node, "corner");
      if (key === "2") ensureNodeType(node, "smooth");
      if (key === "3") ensureNodeType(node, "symmetric");
      commit();
      renderOverlay();
      history?.pushPathChange(state.pathEl, beforeD, modelToPathD(state.model));
      return true;
    }
    return false;
  }

  return {
    enter,
    exit,
    renderOverlay,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onSelectionChanged,
    onKeyDown,
    isActive: () => state.active,
  };
}

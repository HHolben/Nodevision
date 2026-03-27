// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/BezierToolController.mjs
// This module owns Bezier path creation state for the pen tool. This module translates pointer events into path model updates and regenerates the SVG path data while showing a live preview.

import { createEmptyModel, setPathFromModel } from "./BezierModel.mjs";

export function createBezierToolController(deps) {
  const {
    svgRoot,
    overlayPath,
    currentStyleDefaults,
    pointerToleranceInSvgUnits,
    findNearestSnapPointInRoot,
    snapAngleEndpointInRoot,
    rootPointToElementPoint,
    toRootPoint,
    setSelection,
    setStatus,
    getActiveLayer,
    history,
  } = deps;
  const state = {
    active: false,
    model: null,
    pathEl: null,
    layer: null,
    draggingId: null,
    dragMoved: false,
    dragStart: null,
    dragAnchor: null,
    dragVector: { x: 0, y: 0 },
  };
  function reset() { state.active = false; state.model = null; state.layer = null; state.draggingId = null; state.dragMoved = false; state.dragStart = null; if (state.pathEl) { try { state.pathEl.remove(); } catch {} } state.pathEl = null; hidePreview(); }
  function hidePreview() { overlayPath?.setAttribute("display", "none"); }
  function showPreview(pathD) { if (!overlayPath) return; overlayPath.setAttribute("d", pathD || ""); overlayPath.setAttribute("display", ""); }

  function computeHandles(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 0;
    const k = (len * 0.35) / (len || 1);
    return { h1: { x: start.x + dx * k, y: start.y + dy * k }, h2: { x: end.x - dx * k, y: end.y - dy * k } };
  }

  function buildPreview(start, end, curved) {
    if (!start || !end) return "";
    if (!curved) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    const { h1, h2 } = computeHandles(start, end);
    return `M ${start.x} ${start.y} C ${h1.x} ${h1.y} ${h2.x} ${h2.y} ${end.x} ${end.y}`;
  }
  function startPath(pointRoot) {
    state.active = true;
    state.layer = getActiveLayer?.() || svgRoot;
    state.model = createEmptyModel(`path-${Date.now()}`);
    state.model.nodes.push({ x: pointRoot.x, y: pointRoot.y, inHandle: null, outHandle: null, type: "corner" });
    const style = currentStyleDefaults();
    state.pathEl = document.createElementNS(svgRoot.namespaceURI, "path");
    state.pathEl.setAttribute("fill", "none"); state.pathEl.setAttribute("stroke", style.stroke); state.pathEl.setAttribute("stroke-width", style.strokeWidth);
    state.layer.appendChild(state.pathEl);
    setPathFromModel(state.pathEl, state.model); // ensure first Move is written so the point is visible immediately
    history?.pushPathCreate(state.pathEl);
    setSelection?.([state.pathEl], { primary: state.pathEl });
    setStatus?.("Bezier: click to add, drag to curve, Enter to finish, Esc to cancel");
  }

  function commitNode(anchor, curved, dragVec) {
    if (!state.model) return;
    const beforeD = state.pathEl?.getAttribute("d") || "";
    const nodes = state.model.nodes;
    const prev = nodes[nodes.length - 1];
    const node = { x: anchor.x, y: anchor.y, inHandle: null, outHandle: null, type: curved ? "smooth" : "corner" };
    if (curved) {
      const v = dragVec || { x: 0, y: 0 };
      node.inHandle = { x: anchor.x + v.x, y: anchor.y + v.y };
    }
    nodes.push(node);
    setPathFromModel(state.pathEl, state.model);
    const afterD = state.pathEl?.getAttribute("d") || "";
    history?.pushPathChange(state.pathEl, beforeD, afterD);
  }

  function maybeClosePath(endRoot, tolerance) {
    const nodes = state.model?.nodes || [];
    if (nodes.length < 3) return false;
    const first = nodes[0];
    const dx = endRoot.x - first.x;
    const dy = endRoot.y - first.y;
    if (Math.hypot(dx, dy) <= tolerance) {
      const beforeD = state.pathEl?.getAttribute("d") || "";
      state.model.closed = true;
      setPathFromModel(state.pathEl, state.model);
      const afterD = state.pathEl?.getAttribute("d") || "";
      history?.pushPathChange(state.pathEl, beforeD, afterD);
      finish();
      return true;
    }
    return false;
  }

  function finish() {
    if (!state.active) return false;
    hidePreview();
    state.active = false;
    state.draggingId = null;
    state.dragMoved = false;
    state.dragStart = null;
    setSelection?.([state.pathEl], { primary: state.pathEl });
    setStatus?.("Bezier finished");
    return true;
  }
  function cancel() {
    if (state.pathEl) history?.pushPathRemoval(state.pathEl);
    reset();
    setStatus?.("Bezier canceled");
  }

  function onPointerDown(e, pointRoot) {
    if (!state.active) {
      startPath(pointRoot);
      return true;
    }
    state.draggingId = e.pointerId;
    state.dragMoved = false;
    state.dragStart = pointRoot;
    state.dragAnchor = pointRoot;
    state.dragVector = { x: 0, y: 0 };
    try { svgRoot.setPointerCapture(e.pointerId); } catch {}
    return true;
  }

  function onPointerMove(e, pointRoot) {
    if (!state.active) return false;
    if (state.draggingId !== e.pointerId) {
      // hover preview from last node to cursor
      const last = state.model?.nodes[state.model.nodes.length - 1];
      showPreview(buildPreview(last, pointRoot, false));
      return true;
    }
    const dx = pointRoot.x - state.dragStart.x;
    const dy = pointRoot.y - state.dragStart.y;
    const tol = pointerToleranceInSvgUnits(2);
    if (Math.hypot(dx, dy) > tol) state.dragMoved = true;
    state.dragVector = { x: pointRoot.x - state.dragAnchor.x, y: pointRoot.y - state.dragAnchor.y };
    const last = state.model?.nodes[state.model.nodes.length - 1];
    if (state.dragMoved) {
      const anchor = state.dragAnchor;
      const v = state.dragVector;
      const inH = { x: anchor.x + v.x, y: anchor.y + v.y };
      const h1 = last?.outHandle || last || anchor;
      const d = `M ${last.x} ${last.y} C ${h1.x} ${h1.y} ${inH.x} ${inH.y} ${anchor.x} ${anchor.y}`;
      showPreview(d);
    } else {
      const preview = buildPreview(last, pointRoot, false);
      showPreview(preview);
    }
    return true;
  }

  function onPointerUp(e, pointRoot) {
    if (!state.active || state.draggingId !== e.pointerId) return false;
    const last = state.model.nodes[state.model.nodes.length - 1];
    const tol = pointerToleranceInSvgUnits(10);
    const snapped = e.shiftKey && last ? (findNearestSnapPointInRoot(pointRoot, tol) || snapAngleEndpointInRoot(last, pointRoot, Math.PI / 12)) : null;
    const end = snapped || pointRoot;
    const anchor = state.dragAnchor || end;
    const vec = state.dragVector || { x: 0, y: 0 };
    if (!maybeClosePath(anchor, tol)) {
      commitNode(anchor, state.dragMoved, vec);
    }
    state.dragMoved = false;
    state.dragVector = { x: 0, y: 0 };
    state.dragStart = null;
    state.dragAnchor = null;
    state.draggingId = null;
    hidePreview();
    try { svgRoot.releasePointerCapture(e.pointerId); } catch {}
    return true;
  }

  function onKeyDown(e) {
    if (!state.active) return false;
    const key = String(e.key || "");
    if (key === "Escape") {
      cancel();
      return true;
    }
    if (key === "Enter") {
      finish();
      return true;
    }
    if (key === "Backspace") {
      const nodes = state.model?.nodes || [];
      if (nodes.length <= 1) {
        cancel();
      } else {
        const beforeD = state.pathEl?.getAttribute("d") || "";
        nodes.pop();
        setPathFromModel(state.pathEl, state.model);
        const afterD = state.pathEl?.getAttribute("d") || "";
        history?.pushPathChange(state.pathEl, beforeD, afterD);
      }
      return true;
    }
    return false;
  }

  return {
    state,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    finish,
    cancel,
    reset,
    isActive: () => state.active,
  };
}

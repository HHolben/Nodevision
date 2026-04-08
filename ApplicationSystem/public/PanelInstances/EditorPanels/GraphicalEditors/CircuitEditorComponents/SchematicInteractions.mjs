// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/SchematicInteractions.mjs
// This file defines pointer and keyboard interactions for the circuit editor. This file manages placement, selection, dragging, wiring, and deletion.
import { snapPoint, rectFromPoints, pointInRect } from "./CircuitGridUtils.mjs";
import { setSelection, clearSelection, toggleSelection, isSelected } from "./CircuitSelectionModel.mjs";
import { createComponent, createWire, cloneObjects } from "./CircuitObjectFactories.mjs";
import { componentPinsWorld } from "./SchematicRenderer.mjs";
import { distancePointToSegment, rotatePoint, translatePoint } from "./CircuitGeometry.mjs";
import { getSymbol } from "./SymbolLibrary.mjs";

function hitTest(state, point) {
  for (const c of state.document.components) {
    const pins = getSymbol(c.type)?.pins || [];
    for (const pin of pins) {
      const world = translatePoint(rotatePoint({ x: pin.x, y: pin.y }, c.rotation || 0), c.x, c.y);
      if (Math.hypot(point.x - world.x, point.y - world.y) < 8) {
        return { type: "pin", id: `${c.id}:pin:${pin.name}`, componentId: c.id };
      }
    }
  }

  for (const c of state.document.components) {
    const sym = getSymbol(c.type);
    if (!sym) continue;
    const dx = point.x - c.x;
    const dy = point.y - c.y;
    const rad = -((c.rotation || 0) * Math.PI) / 180;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    if (Math.abs(lx) <= (sym.size?.w || 80) / 2 + 6 && Math.abs(ly) <= (sym.size?.h || 40) / 2 + 6) {
      return { type: "component", id: c.id };
    }
  }
  const wire = state.document.wires.find((w) => {
    for (let i = 0; i < w.points.length - 1; i += 1) {
      if (distancePointToSegment(point, w.points[i], w.points[i + 1]) < 6) return { segIndex: i };
    }
    return false;
  });
  if (wire) return { type: "wire", id: wire.id };
  return null;
}

export function setupInteractions(canvas, state, renderer, inspector, hooks) {
  const target = canvas.svg;
  let marquee = null;
  let dragging = null;
  let hoverId = null;

  function moveAttachedWires(dx, dy, movedIds, wireSnapshots) {
    const moved = new Set(movedIds);
    state.document.wires.forEach((w) => {
      const snap = wireSnapshots.get(w.id);
      const basePts = snap ? snap.points : w.points;
      const startHit = w.points[0].__attach || null;
      const endHit = w.points[w.points.length - 1].__attach || null;
      const startCmp = startHit ? startHit.split(":")[0] : null;
      const endCmp = endHit ? endHit.split(":")[0] : null;
      const newStart = { ...basePts[0] };
      const newEnd = { ...basePts[basePts.length - 1] };
      if (startHit && (moved.has(startHit) || moved.has(startCmp))) {
        newStart.x += dx;
        newStart.y += dy;
      }
      if (endHit && (moved.has(endHit) || moved.has(endCmp))) {
        newEnd.x += dx;
        newEnd.y += dy;
      }
      const corner =
        Math.abs(newEnd.x - newStart.x) >= Math.abs(newEnd.y - newStart.y)
          ? { x: newEnd.x, y: newStart.y }
          : { x: newStart.x, y: newEnd.y };
      w.points = [
        { ...newStart },
        { ...corner },
        { ...newEnd },
      ];
    });
  }

  function snapWithPins(point) {
    const pins = [];
    state.document.components.forEach((c) => pins.push(...componentPinsWorld(c)));
    state.document.wires.forEach((w) => pins.push(...w.points));
    let best = null;
    let bestDist = Infinity;
    pins.forEach((p) => {
      const d = Math.hypot(point.x - p.x, point.y - p.y);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    });
    if (best && bestDist < state.document.sheet.gridSize * 0.6) return { x: best.x, y: best.y };
    return snapPoint(point, state.document.sheet.gridSize, state.snap);
  }

  function applySelectionFromRect(rect) {
    const next = [];
    state.document.components.forEach((cmp) => {
      const pins = componentPinsWorld(cmp);
      if (pins.some((p) => pointInRect(p, rect))) next.push(cmp.id);
    });
    state.document.wires.forEach((w) => {
      if (w.points.every((p) => pointInRect(p, rect))) next.push(w.id);
    });
    setSelection(state, next);
    inspector.render();
    renderer.render();
  }

  function pinWorldById(pinId) {
    const [cmpId, , pinName] = pinId.split(":");
    const cmp = state.document.components.find((c) => c.id === cmpId);
    if (!cmp) return null;
    const sym = getSymbol(cmp.type);
    const pin = sym?.pins?.find((p) => p.name === pinName);
    if (!pin) return null;
    return translatePoint(rotatePoint({ x: pin.x, y: pin.y }, cmp.rotation || 0), cmp.x, cmp.y);
  }

  function nearestOnWire(point, wire) {
    let best = wire.points[0];
    let bestDist = Infinity;
    for (let i = 0; i < wire.points.length - 1; i += 1) {
      const a = wire.points[i];
      const b = wire.points[i + 1];
      const d = distancePointToSegment(point, a, b);
      if (d < bestDist) {
        bestDist = d;
        // project
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const wx = point.x - a.x;
        const wy = point.y - a.y;
        const c1 = vx * wx + vy * wy;
        const c2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, c1 / c2));
        best = { x: a.x + t * vx, y: a.y + t * vy };
      }
    }
    return best;
  }

  function startWire(point, hit) {
    let snapped = snapWithPins(point);
    if (hit?.type === "pin") {
      const pinPt = pinWorldById(hit.id);
      if (pinPt) snapped = pinPt;
    } else if (hit?.type === "wire") {
      const wire = state.document.wires.find((w) => w.id === hit.id);
      if (wire) snapped = nearestOnWire(point, wire);
    }
    const start = { ...snapped, __attach: hit?.id || null };
    state.wireDraft = { points: [start, start, start], startHit: hit || null };
  }

  function addWireCorner(point) {
    const draft = state.wireDraft;
    if (!draft) return;
    const last = draft.points[draft.points.length - 2];
    const ortho = orthogonalStep(last, snapWithPins(point));
    draft.points[draft.points.length - 1] = ortho;
    draft.points.push(ortho);
  }

  function finishWire(point, hit) {
    const draft = state.wireDraft;
    if (!draft) return;
    let snapped = snapWithPins(point);
    if (hit?.type === "pin") {
      const pinPt = pinWorldById(hit.id);
      if (pinPt) snapped = pinPt;
    } else if (hit?.type === "wire") {
      const wire = state.document.wires.find((w) => w.id === hit.id);
      if (wire) snapped = nearestOnWire(point, wire);
    }
    const start = draft.points[0];
    const corner = Math.abs(snapped.x - start.x) >= Math.abs(snapped.y - start.y)
      ? { x: snapped.x, y: start.y }
      : { x: start.x, y: snapped.y };
    draft.points[0].__attach = draft.startHit?.id || null;
    draft.points[1] = corner;
    draft.points[2] = { ...snapped, __attach: hit?.id || null };
    state.document.wires.push(createWire(draft.points));
    state.wireDraft = null;
    hooks.onChange?.("Added wire");
    renderer.render();
  }

  function placeComponent(point) {
    if (!state.activeSymbol) return;
    const sym = getSymbol(state.activeSymbol);
    const pos = snapPoint(point, state.document.sheet.gridSize, state.snap);
    function nextRefFor(symbolId) {
      const defaults = getSymbol(symbolId)?.defaults?.ref || "";
      const base = (defaults.replace(/\?/g, "") || symbolId || "X").replace(/[^A-Za-z]+/g, "") || symbolId.slice(0, 1).toUpperCase();
      const current = state.refCounters[symbolId] || 1;
      state.refCounters[symbolId] = current + 1;
      return `${base}${current}`;
    }
    if (sym?.placeMode === "twoPoint") {
      if (!state.placeDraft) {
        state.placeDraft = { start: pos, end: pos };
        renderer.render();
        return;
      }
      const start = state.placeDraft.start;
      const end = pos;
      if (start.x === end.x && start.y === end.y) {
        state.placeDraft = null;
        renderer.render();
        return;
      }
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
      const snapAngle = Math.round(angle / 90) * 90;
      const cmp = createComponent(state.activeSymbol, mid, snapAngle, nextRefFor(state.activeSymbol));
      state.document.components.push(cmp);
      setSelection(state, [cmp.id]);
      state.placeDraft = null;
      hooks.onChange?.("Placed component");
      inspector.render();
      renderer.render();
      return;
    }
    const cmp = createComponent(state.activeSymbol, pos, 0, nextRefFor(state.activeSymbol));
    state.document.components.push(cmp);
    setSelection(state, [cmp.id]);
    hooks.onChange?.("Placed component");
    inspector.render();
    renderer.render();
  }

  target.addEventListener("pointerdown", (evt) => {
    if (evt.button !== 0 || evt.altKey || evt.button === 1 || evt.button === 2) return;
    const world = snapWithPins(canvas.toWorld(evt));
    if (state.tool === "place" && state.activeSymbol) {
      placeComponent(world);
      return;
    }
    if (state.tool === "wire") {
      const hit = hitTest(state, world);
      if (!state.wireDraft) startWire(world, hit); else finishWire(world, hit);
      renderer.render();
      return;
    }
    if (state.placeDraft) {
      // second click for two-point placement already handled in placeComponent
      return;
    }
    const hit = hitTest(state, world);
    if (hit) {
      if (evt.shiftKey) toggleSelection(state, hit.id); else setSelection(state, [hit.id]);
      inspector.render();
      renderer.render();
      const selectedComponents = state.document.components.filter((c) => isSelected(state, c.id));
      const originals = cloneObjects(selectedComponents);
      const wireSnapshots = new Map(
        state.document.wires.map((w) => [w.id, { points: w.points.map((p) => ({ ...p })) }])
      );
      dragging = { start: world, originals, wireSnapshots };
      return;
    }
    marquee = { start: world, current: world };
    clearSelection(state);
    inspector.render();
    renderer.render();
  });

  target.addEventListener("pointermove", (evt) => {
    const world = snapWithPins(canvas.toWorld(evt));
    if (state.wireDraft) {
      const start = state.wireDraft.points[0];
      const corner = Math.abs(world.x - start.x) >= Math.abs(world.y - start.y)
        ? { x: world.x, y: start.y }
        : { x: start.x, y: world.y };
      state.wireDraft.points[1] = corner;
      state.wireDraft.points[2] = world;
      renderer.render();
      return;
    }
    if (state.placeDraft) {
      state.placeDraft.end = world;
      renderer.render();
      return;
    }
    const hit = hitTest(state, world);
    const newHover = hit?.id || null;
    if (newHover !== hoverId) {
      hoverId = newHover;
      hooks.onHover?.(hoverId);
    }
    if (dragging) {
      const dx = world.x - dragging.start.x;
      const dy = world.y - dragging.start.y;
      dragging.originals.forEach((orig) => {
        const live = state.document.components.find((c) => c.id === orig.id);
        if (live) {
          live.x = orig.x + dx;
          live.y = orig.y + dy;
        }
      });
      moveAttachedWires(dx, dy, dragging.originals.map((o) => o.id), dragging.wireSnapshots);
      renderer.render();
      hooks.onTransientChange?.();
      return;
    }
    if (marquee) {
      marquee.current = world;
      const rect = rectFromPoints(marquee.start, marquee.current);
      renderer.render();
      const box = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      box.setAttribute("x", rect.x1);
      box.setAttribute("y", rect.y1);
      box.setAttribute("width", rect.width);
      box.setAttribute("height", rect.height);
      box.setAttribute("fill", "none");
      box.setAttribute("stroke", "#38bdf8");
      box.setAttribute("stroke-dasharray", "4 2");
      canvas.overlayLayer.appendChild(box);
    }
  });

  target.addEventListener("pointerup", () => {
    if (dragging) {
      dragging = null;
      hooks.onChange?.("Moved objects");
    }
    if (marquee) {
      const rect = rectFromPoints(marquee.start, marquee.current);
      applySelectionFromRect(rect);
      marquee = null;
    }
  });

  window.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape") {
      if (state.wireDraft) {
        state.wireDraft = null;
        renderer.render();
        return;
      }
      state.activeSymbol = null;
      state.tool = "select";
      hooks.onToolChange?.();
    }
    if ((evt.key === "Delete" || evt.key === "Backspace") && state.selection.length) {
      hooks.deleteSelection?.();
    }
  });

  return { addWireCorner, finishWire, startWire, placeComponent };
}

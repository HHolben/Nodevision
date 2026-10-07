// Nodevision/ApplicationSystem/public/Sessions/SketchFocusInput.mjs
// This module connects Pointer Events to the Sketch Focus stroke model with coalesced stylus samples, mouse fallback, and simple active-pen palm rejection.

import { sampleFromPointerEvent } from "./SketchFocusModel.mjs";

export function shouldAcceptPointer(event, state = {}) {
  const pointerType = String(event?.pointerType || "mouse");
  if (state.activePenPointerId !== null && state.activePenPointerId !== undefined) {
    if (pointerType === "touch" && event.pointerId !== state.activePenPointerId) return false;
  }
  return pointerType === "pen" || pointerType === "mouse" || pointerType === "touch";
}

export function installSketchPointerInput(surface, model, renderer, getSettings = () => ({})) {
  const state = { activePointerId: null, activePenPointerId: null, drawing: false };

  function samplesFor(event) {
    const rect = surface.getBoundingClientRect();
    const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
    return (events.length ? events : [event]).map((entry) => sampleFromPointerEvent(entry, rect));
  }

  function onPointerDown(event) {
    if (!shouldAcceptPointer(event, state)) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (state.drawing) return;
    event.preventDefault();
    state.activePointerId = event.pointerId;
    if (event.pointerType === "pen") state.activePenPointerId = event.pointerId;
    state.drawing = true;
    surface.setPointerCapture?.(event.pointerId);
    const stroke = model.beginStroke(samplesFor(event)[0], getSettings());
    renderer.drawStroke(stroke);
  }

  function onPointerMove(event) {
    if (!state.drawing || event.pointerId !== state.activePointerId) return;
    event.preventDefault();
    for (const sample of samplesFor(event)) {
      const added = model.addSample(sample);
      if (added) renderer.drawActiveSegment();
    }
  }

  function onPointerEnd(event) {
    if (event.pointerId !== state.activePointerId) return;
    event.preventDefault();
    if (event.type === "pointerup") {
      for (const sample of samplesFor(event)) model.addSample(sample);
      model.finishStroke();
    } else {
      model.cancelActiveStroke();
    }
    surface.releasePointerCapture?.(event.pointerId);
    state.drawing = false;
    state.activePointerId = null;
    if (event.pointerId === state.activePenPointerId) state.activePenPointerId = null;
    renderer.replay();
  }

  surface.addEventListener("pointerdown", onPointerDown);
  surface.addEventListener("pointermove", onPointerMove);
  surface.addEventListener("pointerup", onPointerEnd);
  surface.addEventListener("pointercancel", onPointerEnd);
  surface.addEventListener("lostpointercapture", onPointerEnd);

  return () => {
    if (state.activePointerId !== null) {
      surface.releasePointerCapture?.(state.activePointerId);
      model.cancelActiveStroke();
    }
    surface.removeEventListener("pointerdown", onPointerDown);
    surface.removeEventListener("pointermove", onPointerMove);
    surface.removeEventListener("pointerup", onPointerEnd);
    surface.removeEventListener("pointercancel", onPointerEnd);
    surface.removeEventListener("lostpointercapture", onPointerEnd);
  };
}

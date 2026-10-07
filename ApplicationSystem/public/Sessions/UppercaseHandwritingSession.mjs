// Nodevision/ApplicationSystem/public/Sessions/UppercaseHandwritingSession.mjs
// This module coordinates the experimental uppercase Session using shared sketch input, an isolated recognition facade, and removable UI resources owned by the Session lifecycle.

import { installSketchPointerInput } from "./SketchFocusInput.mjs";
import { loadUppercaseRecognizer } from "../HandwritingRecognition/StrokeRecognition/UppercaseRecognizer.mjs";
import { createUppercaseHandwritingModel } from "./UppercaseHandwritingModel.mjs";
import { createUppercaseView, paintStrokes, resizeUppercaseCanvas, showUppercaseResult } from "./UppercaseHandwritingView.mjs";

export async function startUppercaseHandwriting(context = {}) {
  const root = document.getElementById("nv-session-root");
  if (!root) throw new Error("Uppercase handwriting must run inside a Session.");
  root.replaceChildren();
  const view = createUppercaseView(root);
  view.button("finish").disabled = true;
  let disposed = false;
  let cleanupInput = () => {};
  let observer;
  context.executionContext?.addCleanup?.(() => {
    disposed = true;
    cleanupInput();
    observer?.disconnect();
    view.surface.remove();
  });
  view.button("finish").onclick = () => context.executionContext?.emit?.("uppercaseHandwriting.finished", { ok: true });
  let recognizeLetter;
  try { recognizeLetter = await loadUppercaseRecognizer(); }
  catch (error) {
    if (!disposed) {
      view.output.textContent = `Could not load local templates: ${error.message}. Finish and reopen to retry.`;
      view.button("finish").disabled = false;
    }
    return { ok: false };
  }
  if (disposed) return { ok: false };
  view.button("finish").disabled = false;
  const model = createUppercaseHandwritingModel(recognizeLetter);
  const replay = () => {
    const { strokes, activeStroke } = model.state;
    paintStrokes(view.canvas, [...strokes, ...(activeStroke ? [activeStroke] : [])].map((stroke) => stroke.samples));
    view.button("recognize").disabled = Boolean(activeStroke);
  };
  const renderer = {
    drawStroke() {
      showUppercaseResult(view, null);
      view.output.textContent = "Drawing…";
      view.exportStatus.textContent = "";
      replay();
    },
    drawActiveSegment: replay, replay,
  };
  const resize = () => {
    const size = resizeUppercaseCanvas(view.canvas);
    model.resize(size.width, size.height);
    replay();
  };
  cleanupInput = installSketchPointerInput(view.canvas, model, renderer);
  observer = new ResizeObserver(resize);
  observer.observe(view.canvas);
  resize();
  view.output.textContent = "Draw a capital letter.";
  view.button("recognize").onclick = () => {
    const result = model.recognize();
    if (result) showUppercaseResult(view, result);
  };
  view.button("clear").onclick = () => {
    // Reinstall to reset pointer ownership even if Clear is activated mid-stroke by keyboard.
    cleanupInput();
    model.clear();
    cleanupInput = installSketchPointerInput(view.canvas, model, renderer);
    replay();
    showUppercaseResult(view, null);
    view.output.textContent = "Draw a capital letter.";
    view.expected.value = "";
    view.exportStatus.textContent = "";
  };
  view.button("export").onclick = () => {
    try {
      const fixture = model.fixture(view.expected.value);
      const blob = new Blob([JSON.stringify(fixture, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `uppercase-${fixture.expectedLetter}-${Date.now()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      view.exportStatus.textContent = "Fixture downloaded.";
    } catch (error) { view.exportStatus.textContent = error.message; }
  };
  return { ok: true };
}

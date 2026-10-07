// Nodevision/ApplicationSystem/public/Sessions/UppercaseHandwritingModel.mjs
// This module adapts the shared sketch model to single-character recognition and exports raw labeled regression fixtures independently of rendering and recognition implementations.

import { createSketchModel } from "./SketchFocusModel.mjs";

export function createUppercaseHandwritingModel(recognizeLetter) {
  const sketch = createSketchModel();
  let result = null;
  const strokes = () => sketch.state.strokes.map((stroke) => ({
    points: stroke.samples.map(({ time, ...point }) => ({ ...point, t: time })),
  }));
  return {
    ...sketch,
    beginStroke(sample, settings) { result = null; return sketch.beginStroke(sample, settings); },
    get result() { return result; },
    strokes,
    recognize() {
      if (sketch.state.activeStroke) return null;
      result = recognizeLetter(strokes());
      return result;
    },
    clear() {
      sketch.cancelActiveStroke();
      sketch.state.strokes.length = 0;
      sketch.state.redoStack.length = 0;
      result = null;
    },
    fixture(expectedLetter) {
      if (!/^[A-Z]$/.test(expectedLetter)) throw new Error("Choose the expected capital letter first.");
      if (sketch.state.activeStroke || !sketch.state.strokes.length) throw new Error("Finish drawing a letter first.");
      return {
        schema: "nodevision-uppercase-fixture/1", expectedLetter,
        strokes: strokes(), canvas: { width: sketch.state.width, height: sketch.state.height },
        observed: result ? { letter: result.letter, candidates: result.candidates, diagnostics: result.diagnostics } : null,
      };
    },
  };
}

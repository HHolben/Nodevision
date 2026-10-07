<!-- Nodevision/ApplicationSystem/docs/uppercase-handwriting-prototype.md -->
<!-- This document records reconnaissance, design decisions, validation, and manual testing for the isolated uppercase handwriting Session. -->

# Uppercase handwriting prototype

## Reconnaissance (before implementation)

- `public/Sessions/SketchFocusInput.mjs` already collects Pointer Events with pointer capture, coalesced pen samples, single-pointer ownership, and active-pen palm rejection. `SketchFocusModel.mjs` stores individual strokes and pressure/tilt samples. These are reusable without opening an SVG editor or saving Notebook content.
- SVG editor components provide `PointerInput.mjs`, `StrokeStabilizer.mjs`, `SketchStrokeMath.mjs`, drawing guides, and SVG path/runtime handlers. These are coupled to editor tools; Sketch Focus is the smaller acquisition path for this Session.
- `public/HandwritingRecognition/StrokeRecognition/` already separates glyph coercion, bounding-box normalization, simplification/resampling, template storage, geometric matching, and contextual ranking. Its bundled JSON contains exactly one example for each uppercase letter, plus other characters. A reconnaissance smoke test classified all 26 unchanged uppercase templates correctly, averaging approximately 24 ms per glyph in Node; this is a plumbing check, not handwriting accuracy evidence.
- Existing handwriting UI includes `HandwritingOcrPanel`, trajectory/candidate scoring, `HandwritingOcrMode`, and the handwriting-to-text toolbar callback. Server routes support personal templates and a native handwriting process. No new OCR dependency is needed; this prototype can use the browser-side stroke pipeline entirely locally.
- `Sessions/SessionRegistry.mjs` discovers bundled `.NodevisionSession.js` files. A Session invokes a session-safe command, waits on a registered completion event, and mounts into `nv-session-root`. `SessionExecutionContext.addCleanup` and Session UI ownership restore the workspace on finish/quit.
- The repository has unrelated working changes; this task leaves them intact. Programming standards require explanatory file headers and fewer than 200 nonblank, noncomment lines per native module.

## Decision

Reuse the existing geometric matcher and bundled templates behind a small uppercase-only facade. Disable context ranking, filter the template set to A–Z, and use explicit Recognize so multi-stroke letters do not finish prematurely. Reuse Sketch Focus acquisition/model, with a plain ink renderer for legibility. Keep fixture export separate from template training: expected labels never enter recognition. No cloud, native process, new package, or Notebook mutation is needed.

## Implementation and file map

- `Sessions/BuiltIn/UppercaseHandwriting.NodevisionSession.js`: discoverable **Uppercase Handwriting A–Z** Session.
- `public/Commands/{CommandDefinitions,NodevisionCommandRegistry,NodevisionEventRegistry}.mjs` and `handlers/SystemCommands.mjs`: safe launch command and completion event. An unrelated concurrent extraction of HTML form command definitions is preserved.
- `public/Sessions/UppercaseHandwriting{Session,Model,View}.mjs`: lifecycle and controls, stroke adapter/reset/export, and drawing/diagnostic rendering, respectively.
- `public/Sessions/SketchFocusInput.mjs`: shared fixes for empty coalesced-event lists, final pointer-up samples, primary-button filtering, canceled strokes, lost capture, and cleanup.
- `public/HandwritingRecognition/StrokeRecognition/UppercaseRecognizer.mjs`: replaceable factory returning synchronous `recognizeLetter(strokes)` with `letter`, `confidence`, `candidates`, normalized glyph, and diagnostics. Only uppercase templates are accepted; context ranking is disabled.
- `UppercaseTemplateVariants.mjs`: ten additional editable examples for joined A/B/E/F/G/L/Z, plain/slanted I, and J without a top bar. The existing 26 uppercase templates remain unchanged.
- `UppercaseRecognizer.test.mjs`, `fixtures/uppercase-examples.json`, `public/Sessions/UppercaseHandwritingModel.test.mjs`, and `scripts/{uppercase-handwriting-browser.mjs,test-uppercase-handwriting-browser.py}`: regression coverage and local browser harness.

## Geometry and matching

The sketch model stores an array of strokes, each containing `{x, y, time, pressure, tiltX, tiltY}` samples in CSS pixels. The adapter produces `{points: [{x, y, t, pressure, tiltX, tiltY}]}` strokes for recognition. Pen lifts remain separate strokes. Clear discards both completed and active strokes, redo state, result, and diagnostics.

The existing normalizer translates the bounding box, uniformly scales its largest dimension into a centered unit square with 8% padding, and simplifies redundant geometry. This facade disables pixel-distance filtering before normalization to keep small and large drawings consistent. Matching resamples paths by distance, so timing does not determine the letter. It combines nearest-point geometry, dynamic time warping, directions, endpoints, stroke count, aspect ratio, path length, and coarse occupancy. It considers stroke reversals/order permutations and joined-path alternatives. This is geometric similarity, not exact pixel matching. Modest distortions are tolerated by scoring; orientation is not discarded, since it distinguishes letters.

The UI shows five candidates, a normalized preview, original bounds, stroke count, duration, score components, selected template ID, and the top-two score margin. A margin below 0.06 displays a close-match notice. Scores are similarities, not calibrated probabilities. No expected label, alphabet sequence, previous result, language context, native service, or cloud API influences recognition.

## Launch and manual A–Z test

1. Start Nodevision normally (`npm start` if it is not already running).
2. Open **Run → Session**, select **Uppercase Handwriting A–Z**, and run it.
3. Draw one capital, click **Recognize**, inspect the result, then **Clear**. Repeat A through Z and stop at the first incorrect result. Multiple pen lifts are allowed; there is no inactivity timeout.
4. Before clearing a failure, expand **Diagnostics and regression fixture**, choose the intended letter, and click **Save fixture JSON**. This downloads raw geometry plus the observed candidates locally; it neither trains the recognizer nor changes Notebook content.
5. **Finish** restores the workspace through the normal Session lifecycle. Escape uses the normal Session pause/quit menu.

A downloaded fixture has schema `nodevision-uppercase-fixture/1`, `expectedLetter`, raw `strokes`, canvas dimensions, and optional `observed` diagnostics. Replay it with:

```sh
NV_UPPERCASE_FIXTURE=/absolute/path/to/uppercase-A.json node --test ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/UppercaseRecognizer.test.mjs
```

The expected label is used only for the test assertion. Add a failed fixture to the fixture pack once a correction is ready, preserving the original drawing rather than replacing it with a template.

## Validation results

- Seven focused/new and Session integration test files pass: uppercase recognizer, uppercase model/input, command registry, Session runtime, event bridge, command adapter, and Session registry.
- Recognition regressions cover all 26 bundled uppercase templates under four transformation settings (position, scale, aspect, rotation/skew, variable timing/sample density); these are template-derived plumbing checks, not independent accuracy measurements.
- Twenty independent hand-authored fixtures pass, including A/B/C/D/E/F/G/I/J/L/M/N/O/P/Q/R/U/V/X/Z and reversed stroke order/direction. These are explicitly synthetic paths, not recorded human handwriting. Tests also cover normalization, multistroke input, malformed/empty/zero-length input, uppercase-only output, reset, pointer cancellation, and fixture snapshots.
- Chromium: **52 checks pass**, including drawing with synthetic pen/mouse/touch Pointer Events, ink rendering at device scale factor 2, recognition, Clear mid-stroke, redraw, diagnostic/export content, completion, root layout, cleanup, and template load errors. Latest measured UI recognition mean: **37.0 ms**, maximum **84.6 ms** on this machine. The harness stubs native capture for synthetic events; real hardware/palm behavior still needs manual testing.
- `git diff --check` passes. New native modules are below the 200 nonblank/noncomment-line limit.
- Two broader existing regressions fail, reproduced using baseline test sources: `StrokeRecognizer.test.mjs` classifies a narrow Z as I; `SketchFocusModel.test.mjs` rejects an existing hex paper color in SVG export. Their existing matcher/export behavior was not changed for this Session.

Run the focused checks with:

```sh
node --test ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/UppercaseRecognizer.test.mjs ApplicationSystem/public/Sessions/UppercaseHandwritingModel.test.mjs ApplicationSystem/public/Commands/NodevisionCommandRegistry.test.mjs ApplicationSystem/public/Sessions/SessionRuntime.test.mjs ApplicationSystem/public/Sessions/SessionEventBridge.test.mjs ApplicationSystem/public/Sessions/SessionCommandAdapter.test.mjs ApplicationSystem/Sessions/SessionRegistry.test.mjs
python3 scripts/test-uppercase-handwriting-browser.py
```

## Known limitations and manual observations

Actual handwritten A–Z acceptance has not been performed, so no “Correct through” claim is made. The template library is small. Highly compressed/stretched letters, large rotation, unfamiliar joins, uneven curves, retracing, and unusual stroke counts may still fail. Watch C/G, I/J, O/Q, P/R, U/V, M/N, E/F, and D/O; independent fixtures cover examples of each pair but do not guarantee generalization. B resembling 8 remains ambiguous geometry; numbers are outside the vocabulary. Any nonempty scribble receives an uppercase candidate, so use the score margin and preview when diagnosing failures.

The canvas is responsive and replays stored CSS-coordinate ink on resize without rescaling the stored drawing; shrinking the window can clip existing ink. Clear and redraw after a major resize. Palm rejection is inherited from Sketch Focus and only rejects competing input during an active stroke. For a failed manual letter, preserve the fixture and note the input device and stroke style before clearing. That evidence should drive the next small improvement.

# Experimental Stroke Handwriting Recognition

## Existing Flow

The existing handwriting panel is `ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingOcrPanel.mjs`. It captures pen strokes into `penStrokes`, draws them on a canvas, and can clone those strokes for recognition. Its established recognition path is still coordinated by `HandwritingRecognitionCoordinator.mjs` and tries the existing providers in order: browser-native handwriting recognition when available, the Nodevision custom raster/trajectory template recognizer, and Tesseract OCR for explicit OCR submission. Raster OCR still uses `binarizeCanvas()` to crop and threshold the canvas before Tesseract.

Text insertion is not done by editing `innerHTML`. The Insert -> Handwriting callback in `ApplicationSystem/public/ToolbarCallbacks/insert/handwritingToText.mjs` captures the active editor selection, builds a live text sink, and inserts through textarea, Monaco, or contenteditable range/text-node operations while preserving the editor focus and caret as much as the existing editor integration allows.

HenryScript is used by the existing custom recognizer as a rendered visual template source. The new recognizer does not treat rendered font outlines as stroke-order templates.

## New Experimental Path

The new path is an isolated-character stroke recognizer. It is selectable from the handwriting panel method selector as `Experimental Stroke Recognition`, and the default remains `OCR / existing recognition`. The existing OCR/native/custom coordinator path is not replaced or silently redirected.

When the experimental method is active, the panel uses Pointer Events stroke data directly. After pointer-up it waits about 560 ms before recognizing, unless the user presses Recognize Glyph. It shows the best character, a heuristic match-quality score, up to five alternatives, and an assembled-text preview. Accepting a candidate appends it to the preview and, when live insert is enabled, sends the composed text through the same safe insertion callback used by the existing panel.

The interaction is Scribblenauts-like in the sense that the user writes one isolated character at a time and chooses or corrects immediate character candidates. It does not claim to reproduce Scribblenauts' proprietary implementation.

## Glyph Format

Captured glyphs are represented as ordered strokes with point coordinates, timestamps, pointer type, pressure, tilt, bounds, duration, and canvas dimensions. Pressure and tilt are retained for diagnostics and future work, but recognition does not depend on them.

```js
{
  strokes: [
    {
      pointerType: "pen",
      points: [
        { x, y, t, pressure, tiltX, tiltY }
      ]
    }
  ],
  bounds,
  duration,
  pointerType,
  canvas: { width, height }
}
```

## Normalization

`StrokeNormalizer.mjs` filters duplicate or nearly duplicate points, applies light Douglas-Peucker simplification, preserves corners and direction changes, translates the glyph to a common origin, scales it into a shared coordinate box while preserving aspect ratio, applies padding, and records original and normalized bounds. Very small glyphs and single-point strokes remain valid so dots and accidental taps can be distinguished.

## Scoring

`StrokeTemplateMatcher.mjs` combines several deterministic metrics:

- bidirectional nearest-point distance: weight 0.20
- ordered path distance: weight 0.27
- direction-vector similarity: weight 0.14
- stroke-count similarity: weight 0.10
- start/end endpoint similarity: weight 0.10
- aspect-ratio compatibility: weight 0.08
- total path-length compatibility: weight 0.05
- coarse occupancy-grid similarity: weight 0.06

Stroke order can be flexible for small stroke counts. Template strokes can be direction-reversible, and templates can declare that strokes may be joined. Personal user-approved templates win score ties against built-ins so saved corrections can improve future ranking.

The exposed `confidence` value is a heuristic match score in the range 0 to 1. It should be read as match quality, not as a statistical probability.

## Context Ranking

`StrokeContextRanker.mjs` is optional and local-only. It can nudge plausible geometric candidates using the preceding accepted characters, numeric context, capitalization position, and a small built-in word-prefix list. It only reranks plausible candidates and does not replace a poor geometric match with an unrelated character. The `handwritingStrokeContextRanking` preference disables it.

## Templates And Privacy

Built-in templates are stored in `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/BuiltinStrokeTemplates.json`. User-approved personal templates are saved under `UserData/HandwritingRecognition/StrokeTemplates/` through `ApplicationSystem/server/routes/strokeHandwritingRecognitionRoutes.mjs`.

The panel never automatically saves handwriting samples. The Save button explicitly saves the current drawing as a personal example of the selected or typed character. Stored personal examples include normalized strokes, optional raw glyph data, creation time, recognizer version, format version, source `user-approved`, and pointer metadata. Surrounding document text is not saved.

## Feature Flag

The experimental recognizer is controlled by `handwritingExperimentalStrokeRecognitionEnabled` and the lower-level recognizer option `featureFlagEnabled`. When disabled, the experimental method option is unavailable and the panel falls back to the established OCR method. The default recognition method remains `ocr`.

## Keyboard Shortcuts

Shortcuts are handled only while focus is inside the handwriting panel and the experimental method is active:

- Enter accepts the selected candidate.
- Escape clears/retries the current glyph.
- Backspace clears an unfinished glyph or removes the previous assembled character when the glyph canvas is empty.
- Number keys 1-5 select alternatives.
- Space inserts a space when there is no unfinished glyph.

## Known Limitations

This first implementation recognizes isolated characters only. It does not segment cursive, joined letters, whole words, full pages, editing gestures, Greek characters, or mathematical notation. Built-in templates are demonstrative and should be tuned with real stylus samples. No Web Worker is used yet because the template set is small enough for synchronous matching.

## Manual Test Plan

1. Open an HTML file in graphical/WYSIWYG editing mode.
2. Place the caret inside a paragraph.
3. Open the handwriting panel from Insert -> Handwriting.
4. Confirm `OCR / existing recognition` is still the default method.
5. Select `Experimental Stroke Recognition`.
6. Draw several isolated uppercase letters and wait for recognition after pointer-up.
7. Draw several isolated lowercase letters.
8. Draw digits.
9. Try ambiguous pairs: O/0, I/l/1, S/5, Z/2, B/8, G/6, C/(, period/tap, hyphen/underscore.
10. Select alternate candidates using buttons and number keys 1-5.
11. Press Accept and confirm the character appears in the assembled preview.
12. With live insert enabled, confirm accepted text updates the editor through the existing insertion sink.
13. Disable live insert, compose a short word, and press Insert Text.
14. Type a corrected character in Typed correction and press Use Typed.
15. Press Save this drawing as a personal example and confirm no document text is stored.
16. Draw the same glyph again and confirm the personal template improves ranking.
17. Test mouse input.
18. Test touchscreen or stylus input if available.
19. Switch back to OCR and confirm OCR behavior is unchanged.
20. Reload Nodevision and verify the selected method/context setting persists.
21. Disable `handwritingExperimentalStrokeRecognitionEnabled` in User Preferences and verify the experimental method is unavailable.

## Implementation Report

Files added:

- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeGlyphModel.mjs`
- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeResampler.mjs`
- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeNormalizer.mjs`
- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeFeatureExtractor.mjs`
- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeTemplateStore.mjs`
- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeTemplateMatcher.mjs`
- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeContextRanker.mjs`
- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeRecognizer.mjs`
- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/BuiltinStrokeTemplates.json`
- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeRecognizer.test.mjs`
- `ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/README.md`
- `ApplicationSystem/server/routes/strokeHandwritingRecognitionRoutes.mjs`
- `ApplicationSystem/docs/experimental-stroke-handwriting-recognition.md`

Files changed:

- `ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingOcrPanel.mjs`
- `ApplicationSystem/public/PanelInstances/InfoPanels/UserPreferencesPanel.mjs`
- `ApplicationSystem/server.mjs`

Existing code reused:

- Pointer/canvas drawing from the handwriting panel.
- Selection-preserving text insertion from `ToolbarCallbacks/insert/handwritingToText.mjs`.
- Existing local storage user-preference pattern.
- Existing OCR/native/custom recognition coordinator remains intact for the default method.

Algorithm implemented:

A deterministic template matcher normalizes a captured glyph and each template to canvas-independent coordinates, then combines nearest-point distance, ordered path distance, direction similarity, stroke-count similarity, endpoint similarity, aspect ratio, path length, and occupancy-grid similarity. It supports limited flexible stroke-order permutations, reversible stroke direction, and joined-stroke fallback. Context reranking is optional and local.

Feature-flag behavior:

`handwritingExperimentalStrokeRecognitionEnabled` controls availability. If disabled, the method selector keeps the user on OCR. `handwritingRecognitionMethod` persists the selected method but defaults to OCR. `handwritingStrokeContextRanking` controls local context reranking.

Tests:

Added `StrokeRecognizer.test.mjs` for translation invariance, scale invariance, point-density differences, timing differences, jitter, reversible stroke direction, flexible stroke order, empty glyphs, single-point strokes, tiny glyphs, stale request tracking, candidate sorting, determinism, user-template loading, malformed template rejection, duplicate IDs, confidence thresholds, context reranking, disabled context ranking, feature-flag behavior, and common ambiguous character fixtures.

Test commands attempted:

- `command -v node` returned no Node executable in this environment.

Test results:

Automated Node tests were not run here because `node` is unavailable in the workspace environment. The intended command is:

```sh
node ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeRecognizer.test.mjs
```

Recommended next step:

Run the new unit test under a Node-enabled environment, then tune the built-in templates against real mouse/stylus samples and add browser UI tests for method switching, drawing, alternates, correction, and caret preservation once a UI test harness is available.

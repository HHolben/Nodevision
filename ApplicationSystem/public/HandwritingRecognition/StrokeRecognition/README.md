<!-- Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/README.md -->
<!-- This document explains the experimental isolated-character stroke recognition modules, template format, and local-only recognition behavior. -->
# Experimental Stroke Handwriting Recognition

This module implements a local, deterministic, Scribblenauts-like isolated-character stroke recognizer. It compares ordered pointer trajectories to human-readable JSON stroke templates. It does not rasterize handwriting for OCR and it does not call a network service.

## Modules

- `StrokeGlyphModel.mjs`: glyph/template schemas, point coercion, bounds, cloning, and ID helpers.
- `StrokeResampler.mjs`: duplicate filtering, Douglas-Peucker simplification, point resampling, path length, and reversal.
- `StrokeNormalizer.mjs`: canvas-independent translation, scale normalization, padding, bounds, and duration metadata.
- `StrokeFeatureExtractor.mjs`: nearest-point, path, occupancy, aspect, and path-length features.
- `StrokeTemplateStore.mjs`: built-in template loading plus user-approved template payload/load/save helpers.
- `StrokeTemplateMatcher.mjs`: multi-metric template comparison and candidate sorting.
- `StrokeContextRanker.mjs`: optional local-only context reranking for plausible candidates.
- `StrokeRecognizer.mjs`: public recognizer facade and stale-request tracker.
- `BuiltinStrokeTemplates.json`: built-in trajectory templates for A-Z, a-z, 0-9, and common punctuation.

## Confidence

Candidate `confidence` is a normalized heuristic score from 0 to 1. Higher means a closer geometric match under the current metrics and weights. It is not a statistical probability.

## Template Storage

Built-in templates live with the application. User-approved personal examples are saved through `/api/handwriting-recognition/stroke-templates` under `UserData/HandwritingRecognition/StrokeTemplates/`. Surrounding document text is not stored.

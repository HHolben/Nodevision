<!-- Nodevision/ApplicationSystem/public/RasterVectorization/README.md -->
<!-- This document describes the local raster vectorization service used by Nodevision file viewers to derive editable SVG files from raster image sources without modifying the source image. -->

# Raster Vectorization

The PNG File Viewer invokes this service through `ViewPNG.mjs` and `RasterVectorizationOverlay.mjs`. `File > Export > Convert to SVG` uses the same launcher. The PNG editor is not involved because vectorization creates a derived SVG sibling file instead of editing the PNG.

The service lives in small reusable modules:

- `RasterImageLoader.mjs` loads a viewer raster into `ImageData`.
- `RasterVectorizationService.mjs` exposes `vectorizeRaster()` and debounced preview scheduling.
- `RasterPreprocess.mjs` performs grayscale conversion, contrast, thresholding, invert, speck cleanup, and bold/thin morphology.
- `RasterTrace.mjs` traces black mask regions into real SVG path geometry using deterministic local JavaScript.
- `RasterColorAnalysis.mjs` optionally assigns source-derived colors to traced paths while preserving source-region association.
- `RasterSvgBuilder.mjs` emits portable SVG with a `viewBox`, `<g id="vectorized-artwork">`, and `<path>` elements, never an embedded PNG.
- `RasterVectorizationWorkflow.mjs` reserves a sibling `.svg` path through `/api/create`, saves through `/api/save`, refreshes File Manager, and can open the result through the existing GraphicalEditor route.

No third-party tracing dependency is introduced. The first engine is a local run and region tracer chosen because it works offline, has no license burden beyond Nodevision code, is testable with synthetic `ImageData`, and keeps the PNG viewer decoupled from any tracing-engine-specific API.

Line Drawing mode is tuned for high-contrast scans. Woodcut mode uses the same deterministic pipeline with stronger default contrast, cleanup, simplification, and boldness. The option shape leaves room for future tonal hatching by adding tone-class tracing before SVG construction.

Source colorization is optional and does not affect geometry. Geometry comes from preprocessing and tracing; colors come from original full-color pixels. Each traced path keeps its source rect, and color analysis samples only pixels that are still present in the traced mask, so unrelated pixels inside a path rectangle do not contaminate the average. Color averages use alpha-weighted linear-light RGB, then convert back to sRGB hex for ordinary SVG `fill` values. When transparency is preserved, representative alpha is emitted as `fill-opacity`.

Preview processing is debounced and downsampled for large images. Final SVG creation runs through the full source `ImageData`, creates a sibling file, and can hand off to the existing SVG editor. The modules are viewer-neutral enough for JPEG, WEBP, or future raster viewers to call the same launcher once those viewers provide `ImageData`.

Future palette reduction, color-block separation, and procedural hatching can be added after tracing because path objects already carry logical source-color metadata separate from their SVG geometry.

Color Region mode is separate from Line Drawing and Woodcut. It quantizes opaque source pixels into a limited palette, traces each spatially connected palette region, preserves dark detail as separate regions, and defaults to preserving background coverage. The backgroundPolicy option can deliberately remove light or dark dominant backgrounds, but light regions are not silently treated as background. Statistics include coverage ratio, palette bucket count, path commands, node count, rectangle-path percentage, and small-region count.

The Color Region optimizer now performs OKLab k-means palette reduction before connected-region tracing. Each opaque pixel is assigned to a bounded palette class first, then small low-contrast components are absorbed into neighboring palette regions by shared-boundary/contact score. Dark high-contrast small components are preserved as fine detail. Palette fills are used by default for Color Region output so noisy source averages cannot explode into thousands of unique SVG colors. Smooth contour runs emit cubic Bezier commands, while strong corners remain line segments.

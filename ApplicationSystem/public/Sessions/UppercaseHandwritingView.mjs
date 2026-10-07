// Nodevision/ApplicationSystem/public/Sessions/UppercaseHandwritingView.mjs
// This module creates the uppercase experiment's accessible drawing surface and secondary diagnostics, and renders ink in CSS coordinates independently of recognition.

import { resizeCanvasForDisplay } from "./SketchFocusRenderer.mjs";

export function createUppercaseView(root) {
  const surface = document.createElement("section");
  surface.className = "nv-uppercase";
  surface.innerHTML = `<style>
.nv-uppercase { box-sizing:border-box; width:100%; height:100%; overflow:auto; padding:20px; background:#f4f3ed; color:#222; font:16px system-ui; }
.nv-uppercase h1 { margin:0 0 8px; font-size:24px; }
.nv-uppercase canvas { display:block; background:white; border:2px solid #555; border-radius:8px; touch-action:none; cursor:crosshair; }
.nv-uppercase .drawing { width:min(640px, 100%); height:clamp(240px, 48vh, 520px); }
.nv-uppercase button, .nv-uppercase select { font:inherit; padding:8px 14px; margin:8px 8px 8px 0; }
.nv-uppercase output { display:block; font-size:30px; font-weight:bold; margin:8px 0; }
.nv-uppercase pre { white-space:pre-wrap; font-size:12px; }
.nv-uppercase .preview { width:120px; height:120px; }
</style>
<h1>Uppercase handwriting · A–Z</h1>
<p>Draw one capital letter, using as many strokes as needed. Then choose Recognize.</p>
<canvas class="drawing" aria-label="Draw one uppercase letter"></canvas>
<div><button data-action="recognize" disabled>Recognize</button><button data-action="clear">Clear</button><button data-action="finish">Finish</button></div>
<output aria-live="polite">Loading local templates…</output>
<p class="summary"></p>
<details><summary>Diagnostics and regression fixture</summary>
<p>Scores measure template similarity, not probability. Close scores indicate ambiguity.</p>
<canvas class="preview" width="120" height="120" aria-label="Normalized stroke preview"></canvas>
<pre></pre><label>Expected letter <select aria-label="Expected letter for fixture"><option value="">Choose…</option></select></label>
<button data-action="export">Save fixture JSON</button><span class="export-status" role="status"></span>
</details>`;
  root.appendChild(surface);
  const query = (selector) => surface.querySelector(selector);
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") query("select").add(new Option(letter, letter));
  return {
    surface, canvas: query(".drawing"), output: query("output"), summary: query(".summary"),
    preview: query(".preview"), diagnostics: query("pre"), expected: query("select"),
    exportStatus: query(".export-status"), button: (action) => query(`[data-action="${action}"]`),
  };
}

export function paintStrokes(canvas, strokes, width = canvas.clientWidth, height = canvas.clientHeight) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#202020";
  ctx.fillStyle = "#202020";
  ctx.lineWidth = 3;
  ctx.lineCap = ctx.lineJoin = "round";
  for (const points of strokes) {
    if (!points.length) continue;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    if (points.length === 1) { ctx.beginPath(); ctx.arc(points[0].x, points[0].y, 1.5, 0, Math.PI * 2); ctx.fill(); }
  }
}

export function resizeUppercaseCanvas(canvas) {
  const box = canvas.getBoundingClientRect();
  // The shared helper writes pixel CSS dimensions; retain responsive dimensions after allocating the bitmap.
  const size = resizeCanvasForDisplay(canvas, canvas.clientWidth || box.width, canvas.clientHeight || box.height);
  canvas.style.removeProperty("width");
  canvas.style.removeProperty("height");
  return size;
}

export function showUppercaseResult(view, result) {
  view.output.textContent = result?.letter ? `Recognized: ${result.letter}` : "Draw a capital letter first.";
  view.summary.textContent = result?.letter
    ? `${result.diagnostics.ambiguous ? "Close match — compare candidates. " : ""}Top matches: ${result.candidates.map((c) => `${c.letter} ${(c.score * 100).toFixed(0)}%`).join(" · ")}` : "";
  view.diagnostics.textContent = result ? JSON.stringify({
    bounds: result.glyph.originalBounds, strokeCount: result.glyph.strokes.length,
    ...result.diagnostics, candidates: result.candidates,
  }, null, 2) : "";
  paintStrokes(view.preview, (result?.glyph.strokes || []).map((stroke) =>
    stroke.points.map((point) => ({ x: point.x * 120, y: point.y * 120 }))), 120, 120);
}

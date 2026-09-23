// Nodevision/ApplicationSystem/public/Sessions/SketchFocusSession.mjs
// This module runs the built-in Sketch Focus Session surface inside the existing Nodevision Session root.

import { createSketchModel, GRAPHITE_PRESETS } from "./SketchFocusModel.mjs";
import { drawStroke, replaySketch, resizeCanvasForDisplay } from "./SketchFocusRenderer.mjs";
import { installSketchPointerInput } from "./SketchFocusInput.mjs";
import { finishSketchWorkflow } from "./SketchFocusSave.mjs";

const STYLE_ID = "nv-sketch-focus-session-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#nv-session-root { place-items: stretch; background: #eeeeeb; color: #111; }
.nv-sketch-focus { position: relative; width: 100vw; height: 100vh; overflow: hidden; background: #f1f1ee; touch-action: none; }
.nv-sketch-focus::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .42; background:
  radial-gradient(circle at 13% 19%, rgba(255,255,255,.24), transparent 28%),
  radial-gradient(circle at 81% 71%, rgba(0,0,0,.035), transparent 34%),
  radial-gradient(circle at 48% 42%, rgba(255,255,255,.18), transparent 30%); }
.nv-sketch-canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
.nv-sketch-tools { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); display: flex; gap: 8px; align-items: center; padding: 8px; border: 1px solid rgba(0,0,0,.22); border-radius: 8px; background: rgba(241,241,238,.86); box-shadow: 0 8px 26px rgba(0,0,0,.13); }
.nv-sketch-tools button,
.nv-sketch-tools select,
.nv-sketch-tools input { border: 1px solid #777; border-radius: 6px; background: #f8f8f6; color: #111; font: 13px system-ui, sans-serif; }
.nv-sketch-tools button { min-width: 34px; height: 32px; padding: 0 9px; cursor: pointer; }
.nv-sketch-tools button[aria-pressed="true"] { background: #222; color: #f8f8f6; }
.nv-sketch-tools input { width: 86px; accent-color: #333; }
`;
  document.head.appendChild(style);
}

function createSurface(settings) {
  const surface = document.createElement("div");
  surface.className = "nv-sketch-focus";
  const canvas = document.createElement("canvas");
  canvas.className = "nv-sketch-canvas";
  const tools = document.createElement("div");
  tools.className = "nv-sketch-tools";
  const pencil = toolButton("Pencil", "Pencil", true);
  const eraser = toolButton("Eraser", "Eraser", false);
  const undo = toolButton("Undo", "Undo");
  const redo = toolButton("Redo", "Redo");
  const finish = toolButton("Finish", "Finish");
  const preset = document.createElement("select");
  preset.title = "Graphite darkness";
  for (const name of Object.keys(GRAPHITE_PRESETS)) preset.appendChild(new Option(name, name));
  preset.value = settings.preset;
  const size = document.createElement("input");
  Object.assign(size, { type: "range", min: "1", max: "32", step: "1", value: String(settings.size), title: "Pencil size" });
  tools.append(pencil, eraser, preset, size, undo, redo, finish);
  surface.append(canvas, tools);
  return { surface, canvas, pencil, eraser, preset, size, undo, redo, finish };
}

export async function startSketchFocus(context = {}) {
  ensureStyles();
  const root = document.getElementById("nv-session-root") || document.body;
  root.replaceChildren();
  const settings = { tool: "pencil", preset: "HB", size: 5 };
  const parts = createSurface(settings);
  root.appendChild(parts.surface);
  const model = createSketchModel();
  const renderer = makeRenderer(parts.canvas, model);
  resizeAndReplay(parts.surface, parts.canvas, model, renderer);

  const cleanupInput = installSketchPointerInput(parts.canvas, model, renderer, () => ({ ...settings }));
  const resizeHandler = () => resizeAndReplay(parts.surface, parts.canvas, model, renderer);
  window.addEventListener("resize", resizeHandler);
  wireControls(parts, settings, model, renderer, context);
  context.executionContext?.addCleanup?.(() => {
    cleanupInput();
    window.removeEventListener("resize", resizeHandler);
    window.NodevisionSketchFocusLastSketch = model.snapshot();
    parts.surface.remove();
  });
  return { ok: true };
}

function wireControls(parts, settings, model, renderer, context) {
  let finishing = false;
  const setTool = (tool) => {
    settings.tool = tool;
    parts.pencil.setAttribute("aria-pressed", String(tool === "pencil"));
    parts.eraser.setAttribute("aria-pressed", String(tool === "eraser"));
  };
  parts.pencil.addEventListener("click", () => setTool("pencil"));
  parts.eraser.addEventListener("click", () => setTool("eraser"));
  parts.preset.addEventListener("change", () => { settings.preset = parts.preset.value; });
  parts.size.addEventListener("input", () => { settings.size = Number(parts.size.value) || 5; });
  parts.undo.addEventListener("click", () => { model.undo(); renderer.replay(); });
  parts.redo.addEventListener("click", () => { model.redo(); renderer.replay(); });
  parts.finish.addEventListener("click", async () => {
    if (finishing) return;
    finishing = true;
    try {
      await finishSession(model, context);
    } catch (err) {
      finishing = false;
      console.error("Sketch Focus finish failed:", err);
    }
  });
}

async function finishSession(model, context) {
  const sketch = model.snapshot();
  window.NodevisionSketchFocusLastSketch = sketch;
  const result = await finishSketchWorkflow(sketch, context);
  context.executionContext?.emit?.("sketchFocus.finished", result);
  return result;
}

function makeRenderer(canvas, model) {
  const ctx = canvas.getContext("2d", { alpha: true });
  let renderedSampleCount = 0;
  return {
    drawStroke(stroke) {
      renderedSampleCount = stroke?.samples?.length || 0;
      drawStroke(ctx, stroke);
    },
    drawActiveSegment() {
      const stroke = model.state.activeStroke;
      const samples = stroke?.samples || [];
      if (samples.length < 2 || renderedSampleCount >= samples.length) return;
      drawStroke(ctx, { ...stroke, samples: samples.slice(Math.max(0, samples.length - 2)) });
      renderedSampleCount = samples.length;
    },
    replay() {
      const box = cssCanvasSize(canvas);
      replaySketch(ctx, model.snapshot(), box.width, box.height);
    },
  };
}

function resizeAndReplay(surface, canvas, model, renderer) {
  const rect = surface.getBoundingClientRect();
  const size = resizeCanvasForDisplay(canvas, rect.width || window.innerWidth || 1, rect.height || window.innerHeight || 1);
  model.resize(size.width, size.height);
  renderer.replay();
}

function cssCanvasSize(canvas) {
  return { width: Number.parseFloat(canvas.style.width) || canvas.width || 1, height: Number.parseFloat(canvas.style.height) || canvas.height || 1 };
}

function toolButton(text, title, pressed = null) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.title = title;
  if (pressed !== null) button.setAttribute("aria-pressed", String(pressed));
  return button;
}

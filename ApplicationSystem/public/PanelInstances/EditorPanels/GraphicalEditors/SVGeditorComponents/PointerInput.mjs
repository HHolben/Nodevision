// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PointerInput.mjs
// Pointer Events normalization for SVG-native drawing tools.

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizePointerPressure(event = {}, settings = {}) {
  const pointerType = String(event.pointerType || "mouse").toLowerCase();
  const synthetic = clamp(settings.syntheticMousePressure, 0.02, 1, 0.5);
  const raw = Number(event.pressure);
  const buttonsDown = Number(event.buttons || 0) !== 0 || Number(event.button || 0) === 0;

  if (pointerType === "mouse") return synthetic;
  if (!Number.isFinite(raw) || raw <= 0) {
    return buttonsDown ? synthetic : Math.max(0.02, synthetic * 0.5);
  }
  return clamp(raw, 0.02, 1, synthetic);
}

export function normalizePointerSample(event = {}, rootPoint = {}, previousSample = null, settings = {}) {
  const x = finite(rootPoint.x, NaN);
  const y = finite(rootPoint.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const time = Number.isFinite(Number(event.timeStamp))
    ? Number(event.timeStamp)
    : (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  const pressure = normalizePointerPressure(event, settings);
  const dt = previousSample ? Math.max(0, time - previousSample.time) : 0;
  const distance = previousSample ? Math.hypot(x - previousSample.x, y - previousSample.y) : 0;
  const velocity = dt > 0 ? distance / dt : 0;

  return {
    x,
    y,
    time,
    pressure,
    rawPressure: Number.isFinite(Number(event.pressure)) ? Number(event.pressure) : null,
    pointerId: Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : null,
    pointerType: String(event.pointerType || "mouse").toLowerCase(),
    tiltX: clamp(event.tiltX, -90, 90, 0),
    tiltY: clamp(event.tiltY, -90, 90, 0),
    twist: clamp(event.twist, 0, 359, 0),
    tangentialPressure: clamp(event.tangentialPressure, -1, 1, 0),
    width: clamp(event.width, 0, 10000, 1),
    height: clamp(event.height, 0, 10000, 1),
    buttons: Number(event.buttons || 0),
    shiftKey: Boolean(event.shiftKey),
    altKey: Boolean(event.altKey),
    ctrlKey: Boolean(event.ctrlKey),
    metaKey: Boolean(event.metaKey),
    distanceFromPrevious: distance,
    deltaTime: dt,
    velocity,
  };
}

export function sampleDistance(a, b) {
  if (!a || !b) return Infinity;
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return Infinity;
  return Math.hypot(dx, dy);
}

export function isFiniteSample(sample) {
  return Number.isFinite(Number(sample?.x)) &&
    Number.isFinite(Number(sample?.y)) &&
    Number.isFinite(Number(sample?.time));
}

